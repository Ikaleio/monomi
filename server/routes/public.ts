import { and, asc, desc, eq, gte, inArray } from "drizzle-orm"
import { Hono } from "hono"

import {
  checks,
  dailyStats,
  incidents,
  monitors,
  settings,
  statusPageMonitors,
} from "../db/schema"
import type { AppDeps, AppEnv } from "../http/types"

const priority = {
  outage: 4,
  degraded: 3,
  operational: 2,
  pending: 1,
  paused: 0,
} as const

function availability(
  rows: Array<{ checkCount: number; successCount: number }>
) {
  const total = rows.reduce((sum, row) => sum + row.checkCount, 0)
  const success = rows.reduce((sum, row) => sum + row.successCount, 0)
  return total ? (success / total) * 100 : null
}

export function createPublicRoutes(deps: AppDeps) {
  return new Hono<AppEnv>().get("/status", async (c) => {
    const appSettings = await deps.db.query.settings.findFirst({
      where: eq(settings.id, 1),
    })
    if (!appSettings?.publicEnabled) return c.json({ enabled: false as const })
    const now = deps.now?.() ?? new Date()
    const selected = await deps.db
      .select({ monitor: monitors, sortOrder: statusPageMonitors.sortOrder })
      .from(statusPageMonitors)
      .innerJoin(monitors, eq(monitors.id, statusPageMonitors.monitorId))
      .orderBy(asc(statusPageMonitors.sortOrder))
    const ids = selected.map((entry) => entry.monitor.id)
    const dayStart = new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - 89)
    )
    const last24 = new Date(now.getTime() - 86400000)
    const incidentSince = new Date(now.getTime() - 90 * 86400000)
    const [statsRows, checkRows, incidentRows] = ids.length
      ? await Promise.all([
          deps.db
            .select()
            .from(dailyStats)
            .where(
              and(
                inArray(dailyStats.monitorId, ids),
                gte(dailyStats.date, dayStart.toISOString().slice(0, 10))
              )
            ),
          deps.db
            .select()
            .from(checks)
            .where(
              and(inArray(checks.monitorId, ids), gte(checks.checkedAt, last24))
            ),
          deps.db
            .select({
              id: incidents.id,
              monitorId: incidents.monitorId,
              monitorName: monitors.name,
              startedAt: incidents.startedAt,
              resolvedAt: incidents.resolvedAt,
            })
            .from(incidents)
            .innerJoin(monitors, eq(monitors.id, incidents.monitorId))
            .where(
              and(
                inArray(incidents.monitorId, ids),
                gte(incidents.startedAt, incidentSince)
              )
            )
            .orderBy(desc(incidents.startedAt))
            .limit(50),
        ])
      : [[], [], []]

    const monitorViews = selected.map(({ monitor }) => {
      const ownStats = statsRows.filter((row) => row.monitorId === monitor.id)
      const ownChecks = checkRows.filter((row) => row.monitorId === monitor.id)
      const successfulChecks = ownChecks.filter((row) => row.success)
      const dateMap = new Map(ownStats.map((row) => [row.date, row]))
      const history = Array.from({ length: 90 }, (_, index) => {
        const date = new Date(dayStart.getTime() + index * 86400000)
          .toISOString()
          .slice(0, 10)
        const row = dateMap.get(date)
        if (!row || row.checkCount === 0) {
          return { date, status: "pending" as const, uptime: null, checks: 0 }
        }
        return {
          date,
          status: row.worstStatus,
          uptime: (row.successCount / row.checkCount) * 100,
          checks: row.checkCount,
        }
      })
      const days7 = ownStats.filter(
        (row) =>
          row.date >=
          new Date(now.getTime() - 7 * 86400000).toISOString().slice(0, 10)
      )
      const days30 = ownStats.filter(
        (row) =>
          row.date >=
          new Date(now.getTime() - 30 * 86400000).toISOString().slice(0, 10)
      )
      return {
        id: monitor.id,
        name: monitor.name,
        description: monitor.description,
        status: monitor.status,
        responseTimeMs:
          appSettings.publicShowResponseTime && successfulChecks.length
            ? Math.round(
                successfulChecks.reduce((sum, row) => sum + row.latencyMs, 0) /
                  successfulChecks.length
              )
            : null,
        uptime24h: ownChecks.length
          ? (successfulChecks.length / ownChecks.length) * 100
          : null,
        uptime7d: availability(days7),
        uptime30d: availability(days30),
        history,
      }
    })
    const globalStatus = selected.reduce(
      (worst, entry) =>
        priority[entry.monitor.status] > priority[worst]
          ? entry.monitor.status
          : worst,
      "pending" as keyof typeof priority
    )
    const updatedAt = selected.reduce(
      (latest, entry) =>
        entry.monitor.lastCheckAt && entry.monitor.lastCheckAt > latest
          ? entry.monitor.lastCheckAt
          : latest,
      appSettings.updatedAt
    )
    return c.json({
      enabled: true as const,
      siteName: appSettings.siteName,
      siteDescription: appSettings.siteDescription,
      logoPath: appSettings.logoPath,
      globalStatus,
      updatedAt,
      showResponseTime: appSettings.publicShowResponseTime,
      monitors: monitorViews,
      incidents: incidentRows.map((incident) => ({
        id: incident.id,
        startedAt: incident.startedAt,
        resolvedAt: incident.resolvedAt,
        durationSeconds: Math.max(
          0,
          Math.round(
            ((incident.resolvedAt ?? now).getTime() -
              incident.startedAt.getTime()) /
              1000
          )
        ),
        title: `${incident.monitorName} 服务事件`,
        summary: incident.resolvedAt ? "服务已恢复" : "服务检测失败",
      })),
    })
  })
}
