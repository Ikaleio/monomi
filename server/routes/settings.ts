import { eq } from "drizzle-orm"
import { Hono } from "hono"

import {
  passwordChangeSchema,
  settingsInputSchema,
} from "../../shared/contracts"
import { admins, sessions, settings } from "../db/schema"
import { ApiError } from "../http/errors"
import type { AppDeps, AppEnv } from "../http/types"

async function parseJson(c: { req: { json(): Promise<unknown> } }) {
  try {
    return await c.req.json()
  } catch {
    throw new ApiError(400, "INVALID_JSON", "请求体必须是有效 JSON")
  }
}

function settingsView(row: typeof settings.$inferSelect) {
  return {
    siteName: row.siteName,
    siteDescription: row.siteDescription,
    timezone: row.timezone,
    rawRetentionDays: row.rawRetentionDays,
    dailyRetentionDays: row.dailyRetentionDays,
    notificationRetentionDays: row.notificationRetentionDays,
    defaultIntervalSeconds: row.defaultIntervalSeconds,
    defaultTimeoutMs: row.defaultTimeoutMs,
    defaultFailureThreshold: row.defaultFailureThreshold,
    certificateWarningDays: row.certificateWarningDays,
    publicEnabled: row.publicEnabled,
    publicShowResponseTime: row.publicShowResponseTime,
    logoPath: row.logoPath,
    updatedAt: row.updatedAt,
  }
}

async function getSettings(deps: AppDeps) {
  const row = await deps.db.query.settings.findFirst({
    where: eq(settings.id, 1),
  })
  if (!row) throw new ApiError(500, "SETTINGS_MISSING", "系统设置尚未初始化")
  return row
}

export function createSettingsRoutes(deps: AppDeps) {
  return new Hono<AppEnv>()
    .get("/", async (c) =>
      c.json({ settings: settingsView(await getSettings(deps)) })
    )
    .patch("/", async (c) => {
      const input = settingsInputSchema.parse(await parseJson(c))
      await deps.db
        .update(settings)
        .set({ ...input, updatedAt: deps.now?.() ?? new Date() })
        .where(eq(settings.id, 1))
      return c.json({ settings: settingsView(await getSettings(deps)) })
    })
}

export function createAccountRoutes(deps: AppDeps) {
  return new Hono<AppEnv>().post("/password", async (c) => {
    if (deps.config.authMode === "none") {
      throw new ApiError(409, "AUTH_DISABLED", "认证已关闭")
    }
    const input = passwordChangeSchema.parse(await parseJson(c))
    const adminId = c.get("adminId")
    const admin = await deps.db.query.admins.findFirst({
      where: eq(admins.id, adminId),
    })
    if (
      !admin ||
      !(await Bun.password.verify(input.currentPassword, admin.passwordHash))
    ) {
      throw new ApiError(401, "INVALID_CREDENTIALS", "当前密码错误")
    }
    const passwordHash = await Bun.password.hash(input.newPassword, {
      algorithm: "argon2id",
    })
    deps.db.transaction((tx) => {
      tx.update(admins)
        .set({ passwordHash, updatedAt: deps.now?.() ?? new Date() })
        .where(eq(admins.id, admin.id))
        .run()
      tx.delete(sessions).where(eq(sessions.adminId, admin.id)).run()
    })
    return c.json({ ok: true, loginRequired: true })
  })
}
