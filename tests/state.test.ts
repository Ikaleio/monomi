import { afterEach, describe, expect, test } from "bun:test"
import { mkdtemp, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import path from "node:path"
import { eq } from "drizzle-orm"

import { parseConfig } from "../server/config"
import { checkpointAndClose, openDatabase, type DatabaseClient } from "../server/db/client"
import { incidents, monitors, notificationChannels, notificationDeliveries } from "../server/db/schema"
import { MonitorScheduler } from "../server/services/scheduler"
import { recordOutcome } from "../server/services/state"

const cleanup: Array<{ directory: string; client: DatabaseClient }> = []

async function database() {
  const directory = await mkdtemp(path.join(tmpdir(), "monomi-state-test-"))
  const client = await openDatabase(parseConfig({ MONOMI_DATA_DIR: directory, NODE_ENV: "test" }))
  cleanup.push({ directory, client })
  return client
}

afterEach(async () => {
  for (const item of cleanup.splice(0)) {
    checkpointAndClose(item.client)
    await rm(item.directory, { recursive: true, force: true })
  }
})

function insertMonitor(client: DatabaseClient, id: string, now: Date) {
  client.db.insert(monitors).values({ id, type: "tcp", name: "State target", description: "", configJson: JSON.stringify({ host: "127.0.0.1", port: 1 }), intervalSeconds: 30, timeoutMs: 1000, failureThreshold: 2, latencyThresholdMs: null, enabled: true, status: "pending", consecutiveFailures: 0, nextCheckAt: now, createdAt: now, updatedAt: now }).run()
}

describe("scheduler and state machine", () => {
  test("creates one outage and one recovery delivery", async () => {
    const client = await database()
    const now = new Date("2026-08-18T12:00:00Z")
    const monitorId = crypto.randomUUID()
    const channelId = crypto.randomUUID()
    insertMonitor(client, monitorId, now)
    client.db.insert(notificationChannels).values({ id: channelId, name: "all", url: "http://127.0.0.1", headersJson: "{}", bodyTemplate: '{"event":"{{event}}"}', enabled: true, allMonitors: true, createdAt: now, updatedAt: now }).run()
    recordOutcome(client.db, monitorId, { success: false, latencyMs: 1, errorCode: "CONNECTION_REFUSED" }, now)
    recordOutcome(client.db, monitorId, { success: false, latencyMs: 1, errorCode: "CONNECTION_REFUSED" }, new Date(now.getTime() + 1000))
    expect(client.db.select().from(monitors).where(eq(monitors.id, monitorId)).get()?.status).toBe("outage")
    recordOutcome(client.db, monitorId, { success: true, latencyMs: 1 }, new Date(now.getTime() + 2000))
    expect(client.db.select().from(monitors).where(eq(monitors.id, monitorId)).get()?.status).toBe("operational")
    expect(client.db.select().from(incidents).all()).toHaveLength(1)
    expect(client.db.select().from(notificationDeliveries).all().map((item) => item.eventType)).toEqual(["outage", "recovery"])
  })

  test("coalesces overlapping ticks and advances one interval", async () => {
    const client = await database()
    const now = new Date("2026-08-18T12:00:00Z")
    const monitorId = crypto.randomUUID()
    insertMonitor(client, monitorId, now)
    let calls = 0
    let active = 0
    let maxActive = 0
    let releaseCheck!: () => void
    let signalEntered!: () => void
    const release = new Promise<void>((resolve) => { releaseCheck = resolve })
    const entered = new Promise<void>((resolve) => { signalEntered = resolve })
    const scheduler = new MonitorScheduler(client.db, 1, async () => {
      calls += 1
      active += 1
      maxActive = Math.max(maxActive, active)
      signalEntered()
      await release
      active -= 1
      return { success: true, latencyMs: 1 }
    }, () => now)
    const first = scheduler.runDue(now)
    const second = scheduler.runDue(now)
    await entered
    releaseCheck()
    await Promise.all([first, second])
    const row = client.db.select().from(monitors).where(eq(monitors.id, monitorId)).get()
    expect(calls).toBe(1)
    expect(maxActive).toBe(1)
    expect(row?.nextCheckAt?.toISOString()).toBe("2026-08-18T12:00:30.000Z")
  })
})
