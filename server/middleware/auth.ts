import { eq } from "drizzle-orm"
import { createMiddleware } from "hono/factory"
import { getSignedCookie } from "hono/cookie"

import { sessions } from "../db/schema"
import type { AppDeps, AppEnv } from "../http/types"
import { ApiError } from "../http/errors"

export const SESSION_COOKIE = "monomi_session"
const SESSION_DURATION_MS = 30 * 24 * 60 * 60 * 1000

export async function sha256(value: string) {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(value)
  )
  return Buffer.from(digest).toString("hex")
}

export function sessionExpiresAt(now = new Date()) {
  return new Date(now.getTime() + SESSION_DURATION_MS)
}

export function createAdminMiddleware(deps: AppDeps) {
  return createMiddleware<AppEnv>(async (c, next) => {
    if (deps.config.authMode === "none") {
      c.set("adminId", "auth-disabled")
      await next()
      return
    }
    const token = await getSignedCookie(c, deps.sessionSecret, SESSION_COOKIE)
    if (!token || typeof token !== "string") {
      throw new ApiError(401, "UNAUTHORIZED", "请先登录")
    }
    const tokenHash = await sha256(token)
    const session = await deps.db.query.sessions.findFirst({
      where: eq(sessions.tokenHash, tokenHash),
    })
    const now = deps.now?.() ?? new Date()
    if (!session || session.expiresAt <= now) {
      if (session) {
        await deps.db.delete(sessions).where(eq(sessions.tokenHash, tokenHash))
      }
      throw new ApiError(401, "UNAUTHORIZED", "会话已过期，请重新登录")
    }
    c.set("adminId", session.adminId)
    await next()
  })
}
