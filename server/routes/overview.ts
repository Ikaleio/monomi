import { and, desc, eq, gte } from "drizzle-orm"
import { Hono } from "hono"

import {
  checks,
  monitors,
  notificationDeliveries,
  settings,
} from "../db/schema"
import type { AppDeps, AppEnv } from "../http/types"
import { monitorView } from "../services/monitors"

const priority = {
  outage: 4,
  degraded: 3,
  operational: 2,
  pending: 1,
  paused: 0,
} as const

export function createOverviewRoutes(deps: AppDeps) {
  return new Hono<AppEnv>().get("/", async (c) => {
    const now = deps.now?.() ?? new Date()
    const since = new Date(now.getTime() - 86400000)
    const [allMonitors, recentChecks, failedDeliveries, appSettings] =
      await Promise.all([
        deps.db.query.monitors.findMany(),
        deps.db.select().from(checks).where(gte(checks.checkedAt, since)),
        deps.db
          .select()
          .from(notificationDeliveries)
          .where(eq(notificationDeliveries.status, "failed"))
          .orderBy(desc(notificationDeliveries.id))
          .limit(10),
        deps.db.query.settings.findFirst({ where: eq(settings.id, 1) }),
      ])
    const enabled = allMonitors.filter((monitor) => monitor.enabled)
    const globalStatus =
      enabled.reduce(
        (worst, monitor) =>
          priority[monitor.status] > priority[worst] ? monitor.status : worst,
        "pending" as keyof typeof priority
      ) ?? "pending"
    const successful = recentChecks.filter((check) => check.success)
    const uptime24h = recentChecks.length
      ? (successful.length / recentChecks.length) * 100
      : null
    const averageLatencyMs = successful.length
      ? Math.round(
          successful.reduce((sum, check) => sum + check.latencyMs, 0) /
            successful.length
        )
      : null
    const certificateCutoff = new Date(
      now.getTime() + (appSettings?.certificateWarningDays ?? 30) * 86400000
    )
    const expiring = allMonitors.filter(
      (monitor) =>
        monitor.certificateExpiresAt &&
        monitor.certificateExpiresAt <= certificateCutoff
    )
    const attention = [
      ...allMonitors
        .filter(
          (monitor) =>
            monitor.status === "outage" || monitor.status === "degraded"
        )
        .map((monitor) => ({
          type: monitor.status,
          id: `monitor:${monitor.id}`,
          monitorId: monitor.id,
          title: monitor.name,
          description:
            monitor.status === "outage" ? "服务当前中断" : "服务延迟偏高",
          occurredAt: monitor.lastCheckAt,
        })),
      ...expiring.map((monitor) => ({
        type: "certificate" as const,
        id: `certificate:${monitor.id}`,
        monitorId: monitor.id,
        title: monitor.name,
        description: `证书将在 ${monitor.certificateExpiresAt?.toISOString().slice(0, 10)} 到期`,
        occurredAt: monitor.certificateCheckedAt,
      })),
      ...failedDeliveries.map((delivery) => ({
        type: "webhook" as const,
        id: `delivery:${delivery.id}`,
        monitorId: delivery.monitorId,
        title: "Webhook 发送失败",
        description: delivery.lastError ?? "通知已达到重试上限",
        occurredAt: delivery.createdAt,
      })),
    ]
    return c.json({
      globalStatus,
      uptime24h,
      averageLatencyMs,
      checkCount24h: recentChecks.length,
      enabledCount: enabled.length,
      outageCount: enabled.filter((monitor) => monitor.status === "outage")
        .length,
      expiringCertificateCount: expiring.length,
      monitors: allMonitors.map(monitorView),
      attention,
      updatedAt: now,
    })
  })
}
