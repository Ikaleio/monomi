import { sql } from "drizzle-orm"
import { Hono, type Context } from "hono"
import { serveStatic } from "hono/bun"
import { secureHeaders } from "hono/secure-headers"

import packageJson from "../package.json"
import { createAdminMiddleware } from "./middleware/auth"
import { createAuthRoutes } from "./routes/auth"
import { createBackupRoutes } from "./routes/backups"
import { createConfigTransferRoutes } from "./routes/config-transfer"
import { createHeartbeatRoutes } from "./routes/heartbeat"
import { createIncidentRoutes } from "./routes/incidents"
import { createMonitorRoutes } from "./routes/monitors"
import { createNotificationRoutes } from "./routes/notifications"
import { createOverviewRoutes } from "./routes/overview"
import { createPublicRoutes } from "./routes/public"
import { createAccountRoutes, createSettingsRoutes } from "./routes/settings"
import { createStatusPageRoutes } from "./routes/status-page"
import { handleError, jsonError } from "./http/errors"
import type { AppDeps, AppEnv } from "./http/types"

function safePath(pathname: string) {
  if (pathname.startsWith("/api/heartbeat/")) return "/api/heartbeat/[redacted]"
  return pathname
}

export function createApiRoutes(deps: AppDeps) {
  const api = new Hono<AppEnv>()
  api.use("/admin/*", createAdminMiddleware(deps))
  return api
    .route("/", createAuthRoutes(deps))
    .route("/heartbeat", createHeartbeatRoutes(deps))
    .route("/admin/monitors", createMonitorRoutes(deps))
    .route("/admin/notifications", createNotificationRoutes(deps))
    .route("/admin/overview", createOverviewRoutes(deps))
    .route("/admin/incidents", createIncidentRoutes(deps))
    .route("/admin/settings", createSettingsRoutes(deps))
    .route("/admin/account", createAccountRoutes(deps))
    .route("/admin/status-page", createStatusPageRoutes(deps))
    .route("/public", createPublicRoutes(deps))
    .route("/admin/backups", createBackupRoutes(deps))
    .route("/admin/config", createConfigTransferRoutes(deps))
}

function firstForwardedValue(value: string | undefined) {
  return value?.split(",", 1)[0]?.trim()
}

function requestOrigin(c: Context<AppEnv>) {
  const internal = new URL(c.req.url)
  const protocol = firstForwardedValue(c.req.header("X-Forwarded-Proto"))
  const host =
    firstForwardedValue(c.req.header("X-Forwarded-Host")) ??
    c.req.header("Host")
  if (!protocol || !host) return internal.origin

  try {
    return new URL(`${protocol}://${host}`).origin
  } catch {
    return internal.origin
  }
}

export function createApp(deps: AppDeps) {
  const app = new Hono<AppEnv>()
  app.use("*", secureHeaders())
  app.use("*", async (c, next) => {
    const startedAt = performance.now()
    await next()
    const duration = Math.round(performance.now() - startedAt)
    console.info(
      `${c.req.method} ${safePath(new URL(c.req.url).pathname)} ${c.res.status} ${duration}ms`
    )
  })
  app.use("*", async (c, next) => {
    if (["POST", "PATCH", "PUT", "DELETE"].includes(c.req.method)) {
      const origin = c.req.header("Origin")
      if (origin && origin !== requestOrigin(c)) {
        return jsonError(c, 403, "INVALID_ORIGIN", "请求来源无效")
      }
    }
    await next()
  })

  const apiRoutes = createApiRoutes(deps)
  app.route("/api", apiRoutes)
  app.get("/health", async (c) => {
    deps.db.run(sql`select 1`)
    if (!deps.scheduler.isRunning()) {
      return c.json(
        {
          status: "unavailable",
          database: "ok",
          scheduler: "stopped",
          version: packageJson.version,
        },
        503
      )
    }
    return c.json({
      status: "ok",
      database: "ok",
      scheduler: "running",
      version: packageJson.version,
    })
  })

  app.use("/assets/*", async (c, next) => {
    await next()
    if (c.res.status < 400) {
      c.header("Cache-Control", "public, max-age=31536000, immutable")
    }
  })
  app.get("/assets/*", serveStatic({ root: "./build/client" }))
  app.get("/uploads/*", serveStatic({ root: deps.config.dataDir }))
  app.get("*", serveStatic({ root: "./build/client" }))
  app.get("*", serveStatic({ path: "./build/client/index.html" }))
  app.notFound((c) => {
    if (new URL(c.req.url).pathname.startsWith("/api/")) {
      return jsonError(c, 404, "NOT_FOUND", "接口不存在")
    }
    return c.text("Not Found", 404)
  })
  app.onError((error, c) =>
    handleError(error, c, deps.config.environment === "production")
  )
  return app
}

export type AppType = ReturnType<typeof createApiRoutes>
