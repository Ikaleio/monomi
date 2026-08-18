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
  admins,
  checks,
  dailyStats,
  incidents,
  monitors,
  notificationChannels,
  notificationDeliveries,
  sessions,
  settings,
} from "../server/db/schema"
import { runMonitorCheck } from "../server/checks"
import { RetentionService } from "../server/services/retention"
import { MonitorScheduler } from "../server/services/scheduler"
import { recordCertificate, recordOutcome } from "../server/services/state"

const cleanup: Array<{ directory: string; client: DatabaseClient }> = []

async function database() {
  const directory = await mkdtemp(path.join(tmpdir(), "monomi-state-test-"))
  const client = await openDatabase(
    parseConfig({ MONOMI_DATA_DIR: directory, NODE_ENV: "test" })
  )
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
  client.db
    .insert(monitors)
    .values({
      id,
      type: "tcp",
      name: "State target",
      description: "",
      configJson: JSON.stringify({ host: "127.0.0.1", port: 1 }),
      intervalSeconds: 30,
      timeoutMs: 1000,
      failureThreshold: 2,
      latencyThresholdMs: null,
      enabled: true,
      status: "pending",
      consecutiveFailures: 0,
      nextCheckAt: now,
      createdAt: now,
      updatedAt: now,
    })
    .run()
}

describe("scheduler and state machine", () => {
  test("creates one outage and one recovery delivery", async () => {
    const client = await database()
    const now = new Date("2026-08-18T12:00:00Z")
    const monitorId = crypto.randomUUID()
    const channelId = crypto.randomUUID()
    insertMonitor(client, monitorId, now)
    client.db
      .insert(notificationChannels)
      .values({
        id: channelId,
        name: "all",
        url: "http://127.0.0.1",
        headersJson: "{}",
        bodyTemplate: '{"event":"{{event}}"}',
        enabled: true,
        allMonitors: true,
        createdAt: now,
        updatedAt: now,
      })
      .run()
    recordOutcome(
      client.db,
      monitorId,
      { success: false, latencyMs: 1, errorCode: "CONNECTION_REFUSED" },
      now
    )
    recordOutcome(
      client.db,
      monitorId,
      { success: false, latencyMs: 1, errorCode: "CONNECTION_REFUSED" },
      new Date(now.getTime() + 1000)
    )
    expect(
      client.db.select().from(monitors).where(eq(monitors.id, monitorId)).get()
        ?.status
    ).toBe("outage")
    recordOutcome(
      client.db,
      monitorId,
      { success: true, latencyMs: 1 },
      new Date(now.getTime() + 2000)
    )
    expect(
      client.db.select().from(monitors).where(eq(monitors.id, monitorId)).get()
        ?.status
    ).toBe("operational")
    expect(client.db.select().from(incidents).all()).toHaveLength(1)
    expect(
      client.db
        .select()
        .from(notificationDeliveries)
        .all()
        .map((item) => item.eventType)
    ).toEqual(["outage", "recovery"])
    const aggregate = client.db
      .select()
      .from(dailyStats)
      .where(eq(dailyStats.monitorId, monitorId))
      .get()
    expect(aggregate).toMatchObject({
      checkCount: 3,
      successCount: 1,
      worstStatus: "degraded",
    })
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
    const release = new Promise<void>((resolve) => {
      releaseCheck = resolve
    })
    const entered = new Promise<void>((resolve) => {
      signalEntered = resolve
    })
    const scheduler = new MonitorScheduler(
      client.db,
      1,
      async () => {
        calls += 1
        active += 1
        maxActive = Math.max(maxActive, active)
        signalEntered()
        await release
        active -= 1
        return { success: true, latencyMs: 1 }
      },
      () => now
    )
    const first = scheduler.runDue(now)
    const second = scheduler.runDue(now)
    await entered
    releaseCheck()
    await Promise.all([first, second])
    const row = client.db
      .select()
      .from(monitors)
      .where(eq(monitors.id, monitorId))
      .get()
    expect(calls).toBe(1)
    expect(maxActive).toBe(1)
    expect(row?.nextCheckAt?.toISOString()).toBe("2026-08-18T12:00:30.000Z")
  })

  test("runs one overdue check after a scheduler restart", async () => {
    const client = await database()
    const now = new Date("2026-08-18T12:00:00Z")
    const monitorId = crypto.randomUUID()
    insertMonitor(client, monitorId, new Date(now.getTime() - 86400000))
    let calls = 0
    const checker = async () => {
      calls += 1
      return { success: true, latencyMs: 1 } as const
    }

    await new MonitorScheduler(client.db, 1, checker, () => now).runDue(now)
    await new MonitorScheduler(client.db, 1, checker, () => now).runDue(now)

    expect(calls).toBe(1)
    expect(client.db.select().from(checks).all()).toHaveLength(1)
  })

  test("records unexpected checker errors as failed outcomes", async () => {
    const client = await database()
    const now = new Date("2026-08-18T12:00:00Z")
    const monitorId = crypto.randomUUID()
    insertMonitor(client, monitorId, now)
    client.db
      .update(monitors)
      .set({ failureThreshold: 1 })
      .where(eq(monitors.id, monitorId))
      .run()
    const scheduler = new MonitorScheduler(
      client.db,
      1,
      async () => {
        throw new Error("checker crashed")
      },
      () => now
    )

    const outcome = await scheduler.runNow(monitorId)
    const row = client.db
      .select()
      .from(monitors)
      .where(eq(monitors.id, monitorId))
      .get()
    const recorded = client.db
      .select()
      .from(checks)
      .where(eq(checks.monitorId, monitorId))
      .get()

    expect(outcome).toMatchObject({
      success: false,
      errorCode: "UNKNOWN_ERROR",
      errorMessage: "checker crashed",
    })
    expect(row?.status).toBe("outage")
    expect(recorded).toMatchObject({
      success: false,
      errorCode: "UNKNOWN_ERROR",
      errorMessage: "checker crashed",
    })
  })

  test("detects stale heartbeats at interval plus grace", async () => {
    const client = await database()
    const createdAt = new Date("2026-08-18T12:00:00Z")
    const monitorId = crypto.randomUUID()
    client.db
      .insert(monitors)
      .values({
        id: monitorId,
        type: "heartbeat",
        name: "Heartbeat",
        description: "",
        configJson: JSON.stringify({ graceSeconds: 5 }),
        intervalSeconds: 30,
        timeoutMs: 1000,
        failureThreshold: 2,
        latencyThresholdMs: null,
        enabled: true,
        status: "pending",
        consecutiveFailures: 0,
        nextCheckAt: createdAt,
        createdAt,
        updatedAt: createdAt,
      })
      .run()
    const monitor = client.db
      .select()
      .from(monitors)
      .where(eq(monitors.id, monitorId))
      .get()!

    expect(
      (
        await runMonitorCheck(
          monitor,
          undefined,
          new Date(createdAt.getTime() + 35000)
        )
      ).success
    ).toBe(true)
    expect(
      (
        await runMonitorCheck(
          monitor,
          undefined,
          new Date(createdAt.getTime() + 35001)
        )
      ).errorCode
    ).toBe("TIMEOUT")
  })

  test("deduplicates certificate notifications for one expiry", async () => {
    const client = await database()
    const now = new Date("2026-08-18T12:00:00Z")
    const monitorId = crypto.randomUUID()
    const channelId = crypto.randomUUID()
    const expiresAt = new Date(now.getTime() + 10 * 86400000)
    insertMonitor(client, monitorId, now)
    client.db
      .insert(notificationChannels)
      .values({
        id: channelId,
        name: "certificate",
        url: "http://127.0.0.1",
        headersJson: "{}",
        bodyTemplate: '{"event":"{{event}}"}',
        enabled: true,
        allMonitors: true,
        createdAt: now,
        updatedAt: now,
      })
      .run()

    expect(recordCertificate(client.db, monitorId, expiresAt, now)).toBe(true)
    expect(recordCertificate(client.db, monitorId, expiresAt, now)).toBe(false)
    expect(client.db.select().from(notificationDeliveries).all()).toHaveLength(
      1
    )
  })

  test("removes expired checks, aggregates, sessions, and deliveries", async () => {
    const client = await database()
    const now = new Date("2026-08-18T12:00:00Z")
    const old = new Date(now.getTime() - 40 * 86400000)
    const future = new Date(now.getTime() + 86400000)
    const monitorId = crypto.randomUUID()
    const adminId = crypto.randomUUID()
    const channelId = crypto.randomUUID()
    insertMonitor(client, monitorId, now)
    client.db
      .update(settings)
      .set({
        rawRetentionDays: 30,
        dailyRetentionDays: 30,
        notificationRetentionDays: 30,
      })
      .where(eq(settings.id, 1))
      .run()
    client.db
      .insert(checks)
      .values([
        { monitorId, success: true, latencyMs: 1, checkedAt: old },
        { monitorId, success: true, latencyMs: 1, checkedAt: now },
      ])
      .run()
    client.db
      .insert(dailyStats)
      .values([
        {
          monitorId,
          date: old.toISOString().slice(0, 10),
          checkCount: 1,
          successCount: 1,
          latencyTotalMs: 1,
          latencyMinMs: 1,
          latencyMaxMs: 1,
          worstStatus: "operational",
        },
        {
          monitorId,
          date: now.toISOString().slice(0, 10),
          checkCount: 1,
          successCount: 1,
          latencyTotalMs: 1,
          latencyMinMs: 1,
          latencyMaxMs: 1,
          worstStatus: "operational",
        },
      ])
      .run()
    client.db
      .insert(admins)
      .values({
        id: adminId,
        username: "retention",
        passwordHash: "unused",
        createdAt: now,
        updatedAt: now,
      })
      .run()
    client.db
      .insert(sessions)
      .values([
        { tokenHash: "expired", adminId, expiresAt: old, createdAt: old },
        { tokenHash: "active", adminId, expiresAt: future, createdAt: now },
      ])
      .run()
    client.db
      .insert(notificationChannels)
      .values({
        id: channelId,
        name: "retention",
        url: "http://127.0.0.1",
        headersJson: "{}",
        bodyTemplate: '{"event":"{{event}}"}',
        enabled: true,
        allMonitors: true,
        createdAt: now,
        updatedAt: now,
      })
      .run()
    client.db
      .insert(notificationDeliveries)
      .values([
        {
          channelId,
          eventType: "test",
          status: "sent",
          attempts: 1,
          nextAttemptAt: old,
          payloadJson: "{}",
          dedupeKey: "old",
          createdAt: old,
        },
        {
          channelId,
          eventType: "test",
          status: "sent",
          attempts: 1,
          nextAttemptAt: now,
          payloadJson: "{}",
          dedupeKey: "fresh",
          createdAt: now,
        },
      ])
      .run()

    new RetentionService(client.db).run(now)

    expect(client.db.select().from(checks).all()).toHaveLength(1)
    expect(client.db.select().from(dailyStats).all()).toHaveLength(1)
    expect(client.db.select().from(sessions).all()).toHaveLength(1)
    expect(client.db.select().from(notificationDeliveries).all()).toHaveLength(
      1
    )
  })
})
