import { afterEach, describe, expect, test } from "bun:test"
import { mkdtemp, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import path from "node:path"
import { eq } from "drizzle-orm"

import { parseConfig } from "../server/config"
import {
  checkpointAndClose,
  openDatabase,
  type DatabaseClient,
} from "../server/db/client"
import {
  notificationChannels,
  notificationDeliveries,
} from "../server/db/schema"
import { NotificationDispatcher } from "../server/notifications/dispatcher"
import {
  renderWebhookTemplate,
  validateWebhookTemplate,
} from "../server/notifications/template"

const cleanup: Array<{ directory: string; client: DatabaseClient }> = []
afterEach(async () => {
  for (const item of cleanup.splice(0)) {
    checkpointAndClose(item.client)
    await rm(item.directory, { recursive: true, force: true })
  }
})

async function database() {
  const directory = await mkdtemp(
    path.join(tmpdir(), "monomi-notification-test-")
  )
  const client = await openDatabase(
    parseConfig({ MONOMI_DATA_DIR: directory, NODE_ENV: "test" })
  )
  cleanup.push({ directory, client })
  return client
}

describe("notification dispatcher", () => {
  test("renders only allowed JSON string placeholders with escaping", () => {
    const rendered = renderWebhookTemplate(
      '{"event":"{{event}}","error":"{{check.error}}","latency":"{{check.latencyMs}}"}',
      {
        event: "outage",
        monitor: { name: "API", status: "outage" },
        incident: { startedAt: null, resolvedAt: null, durationSeconds: null },
        check: { error: 'quote " and newline\n', latencyMs: 42 },
      }
    )

    expect(rendered).toEqual({
      event: "outage",
      error: 'quote " and newline\n',
      latency: "42",
    })
    expect(() => validateWebhookTemplate('{"secret":"{{unknown}}"}')).toThrow()
  })

  test("marks a successful rendered delivery as sent", async () => {
    const client = await database()
    const now = new Date("2026-08-18T12:00:00Z")
    const channelId = crypto.randomUUID()
    client.db
      .insert(notificationChannels)
      .values({
        id: channelId,
        name: "success",
        url: "http://127.0.0.1",
        headersJson: '{"Authorization":"token"}',
        bodyTemplate: '{"event":"{{event}}"}',
        enabled: true,
        allMonitors: true,
        createdAt: now,
        updatedAt: now,
      })
      .run()
    const delivery = client.db
      .insert(notificationDeliveries)
      .values({
        channelId,
        monitorId: null,
        eventType: "test",
        status: "pending",
        attempts: 0,
        nextAttemptAt: now,
        payloadJson: JSON.stringify({
          event: "test",
          monitor: { name: "test", status: "operational" },
          incident: {
            startedAt: null,
            resolvedAt: null,
            durationSeconds: null,
          },
          check: { error: null, latencyMs: 0 },
        }),
        dedupeKey: "success-test",
        createdAt: now,
      })
      .returning()
      .get()
    const sentBodies: Record<string, unknown>[] = []
    const dispatcher = new NotificationDispatcher(
      client.db,
      async (_url, headers, body) => {
        expect(headers.Authorization).toBe("token")
        sentBodies.push(body)
        return { ok: true, status: 204 }
      }
    )

    await dispatcher.runDue(now)

    const row = client.db
      .select()
      .from(notificationDeliveries)
      .where(eq(notificationDeliveries.id, delivery.id))
      .get()
    expect(sentBodies).toEqual([{ event: "test" }])
    expect(row).toMatchObject({
      status: "sent",
      attempts: 1,
      responseStatus: 204,
    })
  })

  test("retries immediately, after one minute, and after five minutes", async () => {
    const client = await database()
    const now = new Date("2026-08-18T12:00:00Z")
    const channelId = crypto.randomUUID()
    client.db
      .insert(notificationChannels)
      .values({
        id: channelId,
        name: "retry",
        url: "http://127.0.0.1",
        headersJson: "{}",
        bodyTemplate: '{"event":"{{event}}"}',
        enabled: true,
        allMonitors: true,
        createdAt: now,
        updatedAt: now,
      })
      .run()
    const delivery = client.db
      .insert(notificationDeliveries)
      .values({
        channelId,
        monitorId: null,
        eventType: "test",
        status: "pending",
        attempts: 0,
        nextAttemptAt: now,
        payloadJson: JSON.stringify({
          event: "test",
          monitor: { name: "test", status: "operational" },
          incident: {
            startedAt: null,
            resolvedAt: null,
            durationSeconds: null,
          },
          check: { error: null, latencyMs: 0 },
        }),
        dedupeKey: "retry-test",
        createdAt: now,
      })
      .returning()
      .get()
    const dispatcher = new NotificationDispatcher(client.db, async () => ({
      ok: false,
      status: 503,
      error: "unavailable",
    }))
    await dispatcher.runDue(now)
    let row = client.db
      .select()
      .from(notificationDeliveries)
      .where(eq(notificationDeliveries.id, delivery.id))
      .get()
    expect(row?.attempts).toBe(1)
    expect(row?.nextAttemptAt.toISOString()).toBe("2026-08-18T12:01:00.000Z")
    await dispatcher.runDue(new Date("2026-08-18T12:01:00Z"))
    row = client.db
      .select()
      .from(notificationDeliveries)
      .where(eq(notificationDeliveries.id, delivery.id))
      .get()
    expect(row?.attempts).toBe(2)
    expect(row?.nextAttemptAt.toISOString()).toBe("2026-08-18T12:06:00.000Z")
    await dispatcher.runDue(new Date("2026-08-18T12:06:00Z"))
    row = client.db
      .select()
      .from(notificationDeliveries)
      .where(eq(notificationDeliveries.id, delivery.id))
      .get()
    expect(row?.attempts).toBe(3)
    expect(row?.status).toBe("failed")
  })
})
