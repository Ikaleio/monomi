import { asc, eq } from "drizzle-orm"
import { Hono } from "hono"

import packageJson from "../../package.json"
import { configDocumentSchema, type ConfigDocument } from "../../shared/contracts"
import { checks, dailyStats, incidents, monitorNotificationChannels, monitors, notificationChannels, notificationDeliveries, settings, statusPageMonitors } from "../db/schema"
import { ApiError } from "../http/errors"
import type { AppDeps, AppEnv } from "../http/types"
import { sha256 } from "../middleware/auth"
import { monitorConfig, monitorInputFromRow } from "../services/monitors"

function settingsDocument(row: typeof settings.$inferSelect): ConfigDocument["settings"] {
  return {
    siteName: row.siteName, siteDescription: row.siteDescription, timezone: row.timezone,
    rawRetentionDays: row.rawRetentionDays, dailyRetentionDays: row.dailyRetentionDays,
    notificationRetentionDays: row.notificationRetentionDays,
    defaultIntervalSeconds: row.defaultIntervalSeconds, defaultTimeoutMs: row.defaultTimeoutMs,
    defaultFailureThreshold: row.defaultFailureThreshold, certificateWarningDays: row.certificateWarningDays,
    publicEnabled: row.publicEnabled, publicShowResponseTime: row.publicShowResponseTime,
  }
}

function randomToken() { return Buffer.from(crypto.getRandomValues(new Uint8Array(32))).toString("base64url") }

export function createConfigTransferRoutes(deps: AppDeps) {
  return new Hono<AppEnv>()
    .get("/export", async (c) => {
      const appSettings = await deps.db.query.settings.findFirst({ where: eq(settings.id, 1) })
      if (!appSettings) throw new ApiError(500, "SETTINGS_MISSING", "系统设置尚未初始化")
      const monitorRows = await deps.db.query.monitors.findMany({ orderBy: asc(monitors.name) })
      const channels = await deps.db.query.notificationChannels.findMany({ orderBy: asc(notificationChannels.name) })
      const mappings = await deps.db.query.monitorNotificationChannels.findMany()
      const statusRows = await deps.db.query.statusPageMonitors.findMany({ orderBy: asc(statusPageMonitors.sortOrder) })
      const monitorById = new Map(monitorRows.map((monitor) => [monitor.id, monitor.name]))
      const document: ConfigDocument = {
        schemaVersion: 1,
        version: packageJson.version,
        settings: settingsDocument(appSettings),
        monitors: monitorRows.map(monitorInputFromRow),
        notifications: channels.map((channel) => ({
          name: channel.name,
          url: channel.url,
          enabled: channel.enabled,
          headers: JSON.parse(channel.headersJson) as Record<string, string>,
          bodyTemplate: channel.bodyTemplate,
          monitorNames: channel.allMonitors ? null : mappings.filter((mapping) => mapping.channelId === channel.id).map((mapping) => monitorById.get(mapping.monitorId)).filter((name): name is string => Boolean(name)),
        })),
        statusPageMonitorNames: statusRows.map((row) => monitorById.get(row.monitorId)).filter((name): name is string => Boolean(name)),
      }
      return c.json(document)
    })
    .post("/import", async (c) => {
      const length = Number(c.req.header("Content-Length") ?? 0)
      if (length > 1024 * 1024) throw new ApiError(413, "CONFIG_TOO_LARGE", "配置不得超过 1 MiB")
      let raw: unknown
      try { raw = await c.req.json() } catch { throw new ApiError(400, "INVALID_JSON", "配置必须是有效 JSON") }
      const document = configDocumentSchema.parse(raw)
      const now = deps.now?.() ?? new Date()
      const heartbeatTokens: Array<{ monitorName: string; heartbeatPath: string }> = []
      try {
      deps.db.transaction((tx) => {
        tx.delete(statusPageMonitors).run()
        tx.delete(monitorNotificationChannels).run()
        tx.delete(notificationDeliveries).run()
        tx.delete(notificationChannels).run()
        tx.delete(checks).run()
        tx.delete(dailyStats).run()
        tx.delete(incidents).run()
        tx.delete(monitors).run()
        tx.update(settings).set({ ...document.settings, logoPath: null, updatedAt: now }).where(eq(settings.id, 1)).run()
        const idsByName = new Map<string, string>()
        for (const input of document.monitors) {
          const id = crypto.randomUUID()
          const heartbeatToken = input.type === "heartbeat" ? randomToken() : null
          idsByName.set(input.name, id)
          tx.insert(monitors).values({
            id, type: input.type, name: input.name, description: input.description,
            configJson: JSON.stringify(monitorConfig(input)), intervalSeconds: input.intervalSeconds,
            timeoutMs: input.timeoutMs, failureThreshold: input.failureThreshold,
            latencyThresholdMs: input.latencyThresholdMs ?? null,
            heartbeatTokenHash: heartbeatToken ? Bun.CryptoHasher.hash("sha256", heartbeatToken, "hex") : null,
            enabled: input.enabled, status: input.enabled ? "pending" : "paused",
            consecutiveFailures: 0, nextCheckAt: input.enabled ? now : null, createdAt: now, updatedAt: now,
          }).run()
          if (heartbeatToken) heartbeatTokens.push({ monitorName: input.name, heartbeatPath: `/api/heartbeat/${heartbeatToken}` })
        }
        for (const input of document.notifications) {
          const channelId = crypto.randomUUID()
          tx.insert(notificationChannels).values({ id: channelId, name: input.name, url: input.url, headersJson: JSON.stringify(input.headers), bodyTemplate: input.bodyTemplate, enabled: input.enabled, allMonitors: input.monitorNames === null, createdAt: now, updatedAt: now }).run()
          for (const name of input.monitorNames ?? []) { const monitorId = idsByName.get(name); if (!monitorId) throw new Error(`通知映射引用不存在的监视器：${name}`); tx.insert(monitorNotificationChannels).values({ monitorId, channelId }).run() }
        }
        document.statusPageMonitorNames.forEach((name, sortOrder) => { const monitorId = idsByName.get(name); if (!monitorId) throw new Error(`状态页引用不存在的监视器：${name}`); tx.insert(statusPageMonitors).values({ monitorId, sortOrder }).run() })
        })
      } catch (error) {
        heartbeatTokens.splice(0)
        throw new ApiError(
          400,
          "CONFIG_IMPORT_FAILED",
          error instanceof Error ? error.message : "配置导入失败",
        )
      }
      return c.json({ ok: true, heartbeatTokens })
    })
}
