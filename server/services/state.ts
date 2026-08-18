import { and, eq, or, sql } from "drizzle-orm"

import type { CheckOutcome } from "../checks/types"
import {
  checks,
  dailyStats,
  incidents,
  monitorNotificationChannels,
  monitors,
  notificationChannels,
  notificationDeliveries,
  settings,
} from "../db/schema"
import { ApiError } from "../http/errors"
import type { AppDatabase } from "../http/types"

type RecordOptions = { heartbeat?: boolean }

export function recordOutcome(
  db: AppDatabase,
  monitorId: string,
  outcome: CheckOutcome,
  now = new Date(),
  options: RecordOptions = {},
) {
  return db.transaction((tx) => {
    const monitor = tx.select().from(monitors).where(eq(monitors.id, monitorId)).get()
    if (!monitor) throw new ApiError(404, "MONITOR_NOT_FOUND", "监视器不存在")

    tx.insert(checks)
      .values({
        monitorId,
        success: outcome.success,
        latencyMs: outcome.latencyMs,
        statusCode: outcome.statusCode ?? null,
        errorCode: outcome.errorCode ?? null,
        errorMessage: outcome.errorMessage?.slice(0, 500) ?? null,
        checkedAt: now,
      })
      .run()

    const date = now.toISOString().slice(0, 10)
    const successIncrement = outcome.success ? 1 : 0
    tx.insert(dailyStats)
      .values({
        monitorId,
        date,
        checkCount: 1,
        successCount: successIncrement,
        latencyTotalMs: outcome.latencyMs,
        latencyMinMs: outcome.latencyMs,
        latencyMaxMs: outcome.latencyMs,
        worstStatus: outcome.success ? "operational" : "outage",
      })
      .onConflictDoUpdate({
        target: [dailyStats.monitorId, dailyStats.date],
        set: {
          checkCount: sql`${dailyStats.checkCount} + 1`,
          successCount: sql`${dailyStats.successCount} + ${successIncrement}`,
          latencyTotalMs: sql`${dailyStats.latencyTotalMs} + ${outcome.latencyMs}`,
          latencyMinMs: sql`min(${dailyStats.latencyMinMs}, ${outcome.latencyMs})`,
          latencyMaxMs: sql`max(${dailyStats.latencyMaxMs}, ${outcome.latencyMs})`,
          worstStatus: sql`case
            when ${dailyStats.successCount} + ${successIncrement} = 0 then 'outage'
            when ${dailyStats.successCount} + ${successIncrement} < ${dailyStats.checkCount} + 1 then 'degraded'
            else 'operational'
          end`,
        },
      })
      .run()

    const previousStatus = monitor.status
    const failures = outcome.success ? 0 : monitor.consecutiveFailures + 1
    let status = previousStatus
    if (outcome.success) {
      status =
        monitor.latencyThresholdMs != null &&
        outcome.latencyMs > monitor.latencyThresholdMs
          ? "degraded"
          : "operational"
    } else if (failures >= monitor.failureThreshold) {
      status = "outage"
    } else if (status === "pending") {
      status = "pending"
    }

    let incidentId: number | null = null
    let event: "outage" | "recovery" | null = null
    if (status === "outage" && previousStatus !== "outage") {
      incidentId = tx
        .insert(incidents)
        .values({ monitorId, status: "ongoing", startedAt: now, createdAt: now })
        .returning({ id: incidents.id })
        .get().id
      event = "outage"
    } else if (outcome.success && previousStatus === "outage") {
      const active = tx
        .select()
        .from(incidents)
        .where(and(eq(incidents.monitorId, monitorId), eq(incidents.status, "ongoing")))
        .get()
      if (active) {
        incidentId = active.id
        tx.update(incidents)
          .set({ status: "resolved", resolvedAt: now, resolution: "服务检测恢复" })
          .where(eq(incidents.id, active.id))
          .run()
        event = "recovery"
      }
    }

    tx.update(monitors)
      .set({
        status,
        consecutiveFailures: failures,
        lastCheckAt: now,
        lastSuccessAt: outcome.success ? now : monitor.lastSuccessAt,
        ...(options.heartbeat ? { lastHeartbeatAt: now } : {}),
        updatedAt: now,
      })
      .where(eq(monitors.id, monitorId))
      .run()

    if (event && incidentId != null) {
      const channels = tx
        .select({ id: notificationChannels.id })
        .from(notificationChannels)
        .leftJoin(
          monitorNotificationChannels,
          and(
            eq(monitorNotificationChannels.channelId, notificationChannels.id),
            eq(monitorNotificationChannels.monitorId, monitorId),
          ),
        )
        .where(
          and(
            eq(notificationChannels.enabled, true),
            or(
              eq(notificationChannels.allMonitors, true),
              eq(monitorNotificationChannels.monitorId, monitorId),
            ),
          ),
        )
        .all()
      const startedAt = tx
        .select({ startedAt: incidents.startedAt })
        .from(incidents)
        .where(eq(incidents.id, incidentId))
        .get()?.startedAt
      for (const channel of channels) {
        const payload = {
          event,
          monitor: { id: monitor.id, name: monitor.name, status },
          incident: {
            startedAt,
            resolvedAt: event === "recovery" ? now : null,
            durationSeconds:
              event === "recovery" && startedAt
                ? Math.max(0, Math.round((now.getTime() - startedAt.getTime()) / 1000))
                : null,
          },
          check: {
            error: outcome.errorMessage ?? null,
            latencyMs: outcome.latencyMs,
          },
        }
        tx.insert(notificationDeliveries)
          .values({
            channelId: channel.id,
            monitorId,
            incidentId,
            eventType: event,
            status: "pending",
            attempts: 0,
            nextAttemptAt: now,
            payloadJson: JSON.stringify(payload),
            dedupeKey: `incident:${incidentId}:${event}:${channel.id}`,
            createdAt: now,
          })
          .onConflictDoNothing()
          .run()
      }
    }

    return { status, previousStatus, incidentId, event }
  })
}

export function recordCertificate(
  db: AppDatabase,
  monitorId: string,
  expiresAt: Date | null,
  now = new Date(),
) {
  return db.transaction((tx) => {
    const monitor = tx.select().from(monitors).where(eq(monitors.id, monitorId)).get()
    if (!monitor) throw new ApiError(404, "MONITOR_NOT_FOUND", "监视器不存在")
    if (!expiresAt) {
      tx.update(monitors)
        .set({ certificateCheckedAt: now, updatedAt: now })
        .where(eq(monitors.id, monitorId))
        .run()
      return false
    }
    const expiryChanged =
      monitor.certificateExpiresAt?.getTime() !== expiresAt.getTime()
    const appSettings = tx.select().from(settings).where(eq(settings.id, 1)).get()
    const shouldNotify =
      Boolean(appSettings) &&
      expiresAt.getTime() <=
        now.getTime() + (appSettings?.certificateWarningDays ?? 30) * 86400000 &&
      monitor.certificateNotifiedForExpiry?.getTime() !== expiresAt.getTime()

    tx.update(monitors)
      .set({
        certificateExpiresAt: expiresAt,
        certificateCheckedAt: now,
        certificateNotifiedForExpiry: shouldNotify
          ? expiresAt
          : expiryChanged
            ? null
            : monitor.certificateNotifiedForExpiry,
        updatedAt: now,
      })
      .where(eq(monitors.id, monitorId))
      .run()

    if (!shouldNotify) return false
    const channels = tx
      .select({ id: notificationChannels.id })
      .from(notificationChannels)
      .leftJoin(
        monitorNotificationChannels,
        and(
          eq(monitorNotificationChannels.channelId, notificationChannels.id),
          eq(monitorNotificationChannels.monitorId, monitorId),
        ),
      )
      .where(
        and(
          eq(notificationChannels.enabled, true),
          or(
            eq(notificationChannels.allMonitors, true),
            eq(monitorNotificationChannels.monitorId, monitorId),
          ),
        ),
      )
      .all()
    for (const channel of channels) {
      tx.insert(notificationDeliveries)
        .values({
          channelId: channel.id,
          monitorId,
          eventType: "certificate_expiry",
          status: "pending",
          attempts: 0,
          nextAttemptAt: now,
          payloadJson: JSON.stringify({
            event: "certificate_expiry",
            monitor: { id: monitor.id, name: monitor.name, status: monitor.status },
            incident: { startedAt: null, resolvedAt: null, durationSeconds: null },
            check: { error: null, latencyMs: null },
            certificate: { expiresAt },
          }),
          dedupeKey: `certificate:${monitorId}:${expiresAt.getTime()}:${channel.id}`,
          createdAt: now,
        })
        .onConflictDoNothing()
        .run()
    }
    return true
  })
}
