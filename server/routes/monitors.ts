import { and, asc, desc, eq, gte, lt } from "drizzle-orm"
import { Hono } from "hono"

import {
  monitorInputSchema,
  paginationSchema,
} from "../../shared/contracts"
import {
  checks,
  dailyStats,
  incidents,
  monitors,
} from "../db/schema"
import { ApiError } from "../http/errors"
import type { AppDeps, AppEnv } from "../http/types"
import { sha256 } from "../middleware/auth"
import {
  monitorConfig,
  monitorInputFromRow,
  monitorView,
} from "../services/monitors"

function randomToken() {
  return Buffer.from(crypto.getRandomValues(new Uint8Array(32))).toString("base64url")
}

async function getMonitor(deps: AppDeps, id: string) {
  const monitor = await deps.db.query.monitors.findFirst({
    where: eq(monitors.id, id),
  })
  if (!monitor) throw new ApiError(404, "MONITOR_NOT_FOUND", "监视器不存在")
  return monitor
}

async function parseJson(c: { req: { json(): Promise<unknown> } }) {
  try {
    return await c.req.json()
  } catch {
    throw new ApiError(400, "INVALID_JSON", "请求体必须是有效 JSON")
  }
}

async function resolveIncident(deps: AppDeps, monitorId: string, resolution: string) {
  const now = deps.now?.() ?? new Date()
  await deps.db
    .update(incidents)
    .set({ status: "resolved", resolvedAt: now, resolution })
    .where(and(eq(incidents.monitorId, monitorId), eq(incidents.status, "ongoing")))
}

export function createMonitorRoutes(deps: AppDeps) {
  return new Hono<AppEnv>()
    .get("/", async (c) => {
      const rows = await deps.db.query.monitors.findMany({ orderBy: asc(monitors.name) })
      return c.json({ monitors: rows.map(monitorView) })
    })
    .post("/", async (c) => {
      const input = monitorInputSchema.parse(await parseJson(c))
      const now = deps.now?.() ?? new Date()
      const id = crypto.randomUUID()
      const heartbeatToken = input.type === "heartbeat" ? randomToken() : null
      await deps.db.insert(monitors).values({
        id,
        type: input.type,
        name: input.name,
        description: input.description,
        configJson: JSON.stringify(monitorConfig(input)),
        intervalSeconds: input.intervalSeconds,
        timeoutMs: input.timeoutMs,
        failureThreshold: input.failureThreshold,
        latencyThresholdMs: input.latencyThresholdMs ?? null,
        heartbeatTokenHash: heartbeatToken ? await sha256(heartbeatToken) : null,
        enabled: input.enabled,
        status: input.enabled ? "pending" : "paused",
        consecutiveFailures: 0,
        nextCheckAt: input.enabled ? now : null,
        createdAt: now,
        updatedAt: now,
      })
      const row = await getMonitor(deps, id)
      return c.json(
        {
          monitor: monitorView(row),
          ...(heartbeatToken
            ? { heartbeatPath: `/api/heartbeat/${heartbeatToken}` }
            : {}),
        },
        201,
      )
    })
    .get("/:id", async (c) => c.json({ monitor: monitorView(await getMonitor(deps, c.req.param("id"))) }))
    .patch("/:id", async (c) => {
      const id = c.req.param("id")
      const existing = await getMonitor(deps, id)
      const input = monitorInputSchema.parse(await parseJson(c))
      if (input.type !== existing.type) {
        throw new ApiError(400, "MONITOR_TYPE_IMMUTABLE", "监视器类型不能修改")
      }
      const now = deps.now?.() ?? new Date()
      const previous = monitorInputFromRow(existing)
      const checkConfigChanged =
        JSON.stringify(monitorConfig(previous)) !== JSON.stringify(monitorConfig(input)) ||
        previous.intervalSeconds !== input.intervalSeconds ||
        previous.timeoutMs !== input.timeoutMs ||
        previous.failureThreshold !== input.failureThreshold ||
        previous.latencyThresholdMs !== input.latencyThresholdMs
      const enabledChanged = previous.enabled !== input.enabled
      let status = existing.status
      let nextCheckAt = existing.nextCheckAt
      let consecutiveFailures = existing.consecutiveFailures
      if (!input.enabled) {
        status = "paused"
        nextCheckAt = null
        consecutiveFailures = 0
      } else if (enabledChanged || checkConfigChanged) {
        status = "pending"
        nextCheckAt = now
        consecutiveFailures = 0
      }
      await deps.db
        .update(monitors)
        .set({
          name: input.name,
          description: input.description,
          configJson: JSON.stringify(monitorConfig(input)),
          intervalSeconds: input.intervalSeconds,
          timeoutMs: input.timeoutMs,
          failureThreshold: input.failureThreshold,
          latencyThresholdMs: input.latencyThresholdMs ?? null,
          enabled: input.enabled,
          status,
          nextCheckAt,
          consecutiveFailures,
          updatedAt: now,
        })
        .where(eq(monitors.id, id))
      if (checkConfigChanged) {
        await resolveIncident(deps, id, "监视器配置已更新")
      } else if (!input.enabled && enabledChanged) {
        await resolveIncident(deps, id, "监视器已暂停")
      }
      return c.json({ monitor: monitorView(await getMonitor(deps, id)) })
    })
    .delete("/:id", async (c) => {
      const id = c.req.param("id")
      await getMonitor(deps, id)
      await deps.db.delete(monitors).where(eq(monitors.id, id))
      return c.body(null, 204)
    })
    .post("/:id/run", async (c) => {
      const monitor = await getMonitor(deps, c.req.param("id"))
      if (monitor.type === "heartbeat") {
        throw new ApiError(400, "HEARTBEAT_MANUAL_RUN_UNSUPPORTED", "Heartbeat 不支持手动检测")
      }
      return c.json({ outcome: await deps.scheduler.runNow(monitor.id) })
    })
    .post("/:id/heartbeat-token", async (c) => {
      const monitor = await getMonitor(deps, c.req.param("id"))
      if (monitor.type !== "heartbeat") {
        throw new ApiError(400, "NOT_HEARTBEAT_MONITOR", "该监视器不是 Heartbeat")
      }
      const token = randomToken()
      await deps.db
        .update(monitors)
        .set({ heartbeatTokenHash: await sha256(token), updatedAt: deps.now?.() ?? new Date() })
        .where(eq(monitors.id, monitor.id))
      return c.json({ heartbeatPath: `/api/heartbeat/${token}` })
    })
    .get("/:id/checks", async (c) => {
      const monitor = await getMonitor(deps, c.req.param("id"))
      const query = paginationSchema.parse(c.req.query())
      const predicates = [eq(checks.monitorId, monitor.id)]
      if (query.cursor) predicates.push(lt(checks.id, query.cursor))
      const rows = await deps.db
        .select()
        .from(checks)
        .where(and(...predicates))
        .orderBy(desc(checks.id))
        .limit(query.limit + 1)
      const hasMore = rows.length > query.limit
      const items = hasMore ? rows.slice(0, query.limit) : rows
      return c.json({ checks: items, nextCursor: hasMore ? items.at(-1)?.id : null })
    })
    .get("/:id/metrics", async (c) => {
      const monitor = await getMonitor(deps, c.req.param("id"))
      if ((c.req.query("window") ?? "24h") !== "24h") {
        throw new ApiError(400, "INVALID_WINDOW", "仅支持 24h 时间窗口")
      }
      const since = new Date((deps.now?.() ?? new Date()).getTime() - 24 * 60 * 60 * 1000)
      const rows = await deps.db
        .select()
        .from(checks)
        .where(and(eq(checks.monitorId, monitor.id), gte(checks.checkedAt, since)))
        .orderBy(asc(checks.checkedAt))
      const buckets = new Map<number, { total: number; count: number; failures: number }>()
      for (const row of rows) {
        const time = Math.floor(row.checkedAt.getTime() / 300000) * 300000
        const bucket = buckets.get(time) ?? { total: 0, count: 0, failures: 0 }
        if (row.success) {
          bucket.total += row.latencyMs
          bucket.count += 1
        } else bucket.failures += 1
        buckets.set(time, bucket)
      }
      return c.json({
        buckets: [...buckets].map(([time, value]) => ({
          time: new Date(time),
          latencyMs: value.count ? Math.round(value.total / value.count) : null,
          failures: value.failures,
        })),
      })
    })
    .get("/:id/history", async (c) => {
      const monitor = await getMonitor(deps, c.req.param("id"))
      const days = Math.min(90, Math.max(1, Number(c.req.query("days") ?? 90)))
      if (!Number.isInteger(days)) throw new ApiError(400, "INVALID_DAYS", "天数必须为整数")
      const end = deps.now?.() ?? new Date()
      const start = new Date(Date.UTC(end.getUTCFullYear(), end.getUTCMonth(), end.getUTCDate() - days + 1))
      const startDate = start.toISOString().slice(0, 10)
      const rows = await deps.db
        .select()
        .from(dailyStats)
        .where(and(eq(dailyStats.monitorId, monitor.id), gte(dailyStats.date, startDate)))
      const byDate = new Map(rows.map((row) => [row.date, row]))
      const history = Array.from({ length: days }, (_, index) => {
        const date = new Date(start.getTime() + index * 86400000).toISOString().slice(0, 10)
        const row = byDate.get(date)
        if (!row || row.checkCount === 0) return { date, status: "pending" as const, uptime: null, checks: 0 }
        return {
          date,
          status: row.worstStatus,
          uptime: (row.successCount / row.checkCount) * 100,
          checks: row.checkCount,
        }
      })
      return c.json({ history })
    })
}
