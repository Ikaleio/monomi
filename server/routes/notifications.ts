import { asc, desc, eq, inArray } from "drizzle-orm"
import { Hono } from "hono"

import { webhookInputSchema } from "../../shared/contracts"
import {
  monitorNotificationChannels,
  monitors,
  notificationChannels,
  notificationDeliveries,
} from "../db/schema"
import { ApiError } from "../http/errors"
import type { AppDeps, AppEnv } from "../http/types"
import { validateWebhookTemplate } from "../notifications/template"

async function parseJson(c: { req: { json(): Promise<unknown> } }) {
  try {
    return await c.req.json()
  } catch {
    throw new ApiError(400, "INVALID_JSON", "请求体必须是有效 JSON")
  }
}

async function getChannel(deps: AppDeps, id: string) {
  const channel = await deps.db.query.notificationChannels.findFirst({
    where: eq(notificationChannels.id, id),
  })
  if (!channel) throw new ApiError(404, "CHANNEL_NOT_FOUND", "通知渠道不存在")
  return channel
}

async function monitorIdsForChannel(deps: AppDeps, channelId: string) {
  const rows = await deps.db
    .select({ monitorId: monitorNotificationChannels.monitorId })
    .from(monitorNotificationChannels)
    .where(eq(monitorNotificationChannels.channelId, channelId))
    .orderBy(asc(monitorNotificationChannels.monitorId))
  return rows.map((row) => row.monitorId)
}

async function channelView(deps: AppDeps, id: string) {
  const channel = await getChannel(deps, id)
  return {
    id: channel.id,
    name: channel.name,
    url: channel.url,
    enabled: channel.enabled,
    headers: JSON.parse(channel.headersJson) as Record<string, string>,
    bodyTemplate: channel.bodyTemplate,
    monitorIds: channel.allMonitors ? null : await monitorIdsForChannel(deps, id),
    createdAt: channel.createdAt,
    updatedAt: channel.updatedAt,
  }
}

async function assertMonitors(deps: AppDeps, ids: string[] | null) {
  if (!ids?.length) return
  const rows = await deps.db
    .select({ id: monitors.id })
    .from(monitors)
    .where(inArray(monitors.id, ids))
  if (rows.length !== new Set(ids).size) {
    throw new ApiError(400, "INVALID_MONITOR_IDS", "通知范围包含不存在的监视器")
  }
}

export function createNotificationRoutes(deps: AppDeps) {
  return new Hono<AppEnv>()
    .get("/", async (c) => {
      const channels = await deps.db.query.notificationChannels.findMany({
        orderBy: asc(notificationChannels.name),
      })
      const deliveries = await deps.db
        .select()
        .from(notificationDeliveries)
        .orderBy(desc(notificationDeliveries.id))
        .limit(50)
      return c.json({
        channels: await Promise.all(channels.map((channel) => channelView(deps, channel.id))),
        deliveries,
      })
    })
    .post("/", async (c) => {
      const input = webhookInputSchema.parse(await parseJson(c))
      validateWebhookTemplate(input.bodyTemplate)
      await assertMonitors(deps, input.monitorIds)
      const now = deps.now?.() ?? new Date()
      const id = crypto.randomUUID()
      deps.db.transaction((tx) => {
        tx.insert(notificationChannels)
          .values({
            id,
            name: input.name,
            url: input.url,
            headersJson: JSON.stringify(input.headers),
            bodyTemplate: input.bodyTemplate,
            enabled: input.enabled,
            allMonitors: input.monitorIds === null,
            createdAt: now,
            updatedAt: now,
          })
          .run()
        for (const monitorId of input.monitorIds ?? []) {
          tx.insert(monitorNotificationChannels).values({ monitorId, channelId: id }).run()
        }
      })
      return c.json({ channel: await channelView(deps, id) }, 201)
    })
    .patch("/:id", async (c) => {
      const channel = await getChannel(deps, c.req.param("id"))
      const input = webhookInputSchema.parse(await parseJson(c))
      validateWebhookTemplate(input.bodyTemplate)
      await assertMonitors(deps, input.monitorIds)
      const now = deps.now?.() ?? new Date()
      deps.db.transaction((tx) => {
        tx.update(notificationChannels)
          .set({
            name: input.name,
            url: input.url,
            headersJson: JSON.stringify(input.headers),
            bodyTemplate: input.bodyTemplate,
            enabled: input.enabled,
            allMonitors: input.monitorIds === null,
            updatedAt: now,
          })
          .where(eq(notificationChannels.id, channel.id))
          .run()
        tx.delete(monitorNotificationChannels)
          .where(eq(monitorNotificationChannels.channelId, channel.id))
          .run()
        for (const monitorId of input.monitorIds ?? []) {
          tx.insert(monitorNotificationChannels)
            .values({ monitorId, channelId: channel.id })
            .run()
        }
      })
      return c.json({ channel: await channelView(deps, channel.id) })
    })
    .delete("/:id", async (c) => {
      const channel = await getChannel(deps, c.req.param("id"))
      await deps.db.delete(notificationChannels).where(eq(notificationChannels.id, channel.id))
      return c.body(null, 204)
    })
    .post("/:id/test", async (c) => {
      const channel = await getChannel(deps, c.req.param("id"))
      const now = deps.now?.() ?? new Date()
      const delivery = await deps.db
        .insert(notificationDeliveries)
        .values({
          channelId: channel.id,
          monitorId: null,
          eventType: "test",
          status: "pending",
          attempts: 0,
          nextAttemptAt: now,
          payloadJson: JSON.stringify({
            event: "test",
            monitor: { name: "Monomi 测试通知", status: "operational" },
            incident: { startedAt: null, resolvedAt: null, durationSeconds: null },
            check: { error: null, latencyMs: 0 },
          }),
          dedupeKey: `test:${crypto.randomUUID()}`,
          createdAt: now,
        })
        .returning()
        .get()
      await deps.dispatcher.runDue(now)
      const result = await deps.db.query.notificationDeliveries.findFirst({
        where: eq(notificationDeliveries.id, delivery.id),
      })
      return c.json({ delivery: result }, result?.status === "sent" ? 200 : 202)
    })
}
