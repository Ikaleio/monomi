import { eq } from "drizzle-orm"
import { Hono } from "hono"
import { deleteCookie, getSignedCookie, setSignedCookie } from "hono/cookie"
import type { Context } from "hono"

import { loginInputSchema, setupInputSchema } from "../../shared/contracts"
import { admins, sessions } from "../db/schema"
import { ApiError } from "../http/errors"
import type { AppDeps, AppEnv } from "../http/types"
import { SESSION_COOKIE, sessionExpiresAt, sha256 } from "../middleware/auth"

async function parseJson(c: Context) {
  try {
    return await c.req.json()
  } catch {
    throw new ApiError(400, "INVALID_JSON", "请求体必须是有效 JSON")
  }
}

async function issueSession(c: Context, deps: AppDeps, adminId: string) {
  const token = Buffer.from(
    crypto.getRandomValues(new Uint8Array(32))
  ).toString("base64url")
  const now = deps.now?.() ?? new Date()
  const expiresAt = sessionExpiresAt(now)
  await deps.db.insert(sessions).values({
    tokenHash: await sha256(token),
    adminId,
    expiresAt,
    createdAt: now,
  })
  await setSignedCookie(c, SESSION_COOKIE, token, deps.sessionSecret, {
    httpOnly: true,
    sameSite: "Lax",
    secure: deps.config.secureCookie,
    path: "/",
    expires: expiresAt,
    maxAge: Math.floor((expiresAt.getTime() - now.getTime()) / 1000),
  })
}

async function currentAdmin(c: Context, deps: AppDeps) {
  if (deps.config.authMode === "none") {
    return { id: "auth-disabled", username: "管理员" }
  }
  const token = await getSignedCookie(c, deps.sessionSecret, SESSION_COOKIE)
  if (!token || typeof token !== "string") return null
  const tokenHash = await sha256(token)
  const session = await deps.db.query.sessions.findFirst({
    where: eq(sessions.tokenHash, tokenHash),
  })
  const now = deps.now?.() ?? new Date()
  if (!session || session.expiresAt <= now) return null
  return (
    (await deps.db.query.admins.findFirst({
      where: eq(admins.id, session.adminId),
      columns: { id: true, username: true },
    })) ?? null
  )
}

export function createAuthRoutes(deps: AppDeps) {
  return new Hono<AppEnv>()
    .get("/setup/status", async (c) => {
      const initialized = Boolean(await deps.db.query.admins.findFirst())
      const admin = await currentAdmin(c, deps)
      return c.json({
        authMode: deps.config.authMode,
        initialized: deps.config.authMode === "none" || initialized,
        authenticated: deps.config.authMode === "none" || Boolean(admin),
      })
    })
    .post("/setup", async (c) => {
      if (deps.config.authMode === "none") {
        throw new ApiError(409, "AUTH_DISABLED", "认证已关闭")
      }
      if (await deps.db.query.admins.findFirst()) {
        throw new ApiError(409, "ALREADY_INITIALIZED", "管理员已经创建")
      }
      const input = setupInputSchema.parse(await parseJson(c))
      const admin = {
        id: crypto.randomUUID(),
        username: input.username,
        passwordHash: await Bun.password.hash(input.password, {
          algorithm: "argon2id",
        }),
        createdAt: deps.now?.() ?? new Date(),
        updatedAt: deps.now?.() ?? new Date(),
      }
      try {
        await deps.db.insert(admins).values(admin)
      } catch (error) {
        if (await deps.db.query.admins.findFirst()) {
          throw new ApiError(409, "ALREADY_INITIALIZED", "管理员已经创建")
        }
        throw error
      }
      await issueSession(c, deps, admin.id)
      return c.json({ user: { id: admin.id, username: admin.username } }, 201)
    })
    .post("/auth/login", async (c) => {
      if (deps.config.authMode === "none") {
        throw new ApiError(409, "AUTH_DISABLED", "认证已关闭")
      }
      const input = loginInputSchema.parse(await parseJson(c))
      const admin = await deps.db.query.admins.findFirst({
        where: eq(admins.username, input.username),
      })
      if (
        !admin ||
        !(await Bun.password.verify(input.password, admin.passwordHash))
      ) {
        throw new ApiError(401, "INVALID_CREDENTIALS", "用户名或密码错误")
      }
      await issueSession(c, deps, admin.id)
      return c.json({ user: { id: admin.id, username: admin.username } })
    })
    .post("/auth/logout", async (c) => {
      const token = await getSignedCookie(c, deps.sessionSecret, SESSION_COOKIE)
      if (token && typeof token === "string") {
        await deps.db
          .delete(sessions)
          .where(eq(sessions.tokenHash, await sha256(token)))
      }
      deleteCookie(c, SESSION_COOKIE, {
        path: "/",
        secure: deps.config.secureCookie,
      })
      return c.json({ ok: true })
    })
    .get("/auth/session", async (c) => {
      const admin = await currentAdmin(c, deps)
      return c.json({ authenticated: Boolean(admin), user: admin })
    })
}
