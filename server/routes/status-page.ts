import { asc, eq, inArray } from "drizzle-orm"
import { Hono } from "hono"
import { unlink } from "node:fs/promises"
import path from "node:path"

import { statusPageInputSchema } from "../../shared/contracts"
import { monitors, settings, statusPageMonitors } from "../db/schema"
import { ApiError } from "../http/errors"
import type { AppDeps, AppEnv } from "../http/types"

function imageType(bytes: Uint8Array) {
  if (
    bytes.length >= 8 &&
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47
  )
    return { mime: "image/png", extension: "png" }
  if (
    bytes.length >= 3 &&
    bytes[0] === 0xff &&
    bytes[1] === 0xd8 &&
    bytes[2] === 0xff
  ) {
    return { mime: "image/jpeg", extension: "jpg" }
  }
  if (
    bytes.length >= 12 &&
    new TextDecoder().decode(bytes.slice(0, 4)) === "RIFF" &&
    new TextDecoder().decode(bytes.slice(8, 12)) === "WEBP"
  )
    return { mime: "image/webp", extension: "webp" }
  return null
}

async function currentSettings(deps: AppDeps) {
  const row = await deps.db.query.settings.findFirst({
    where: eq(settings.id, 1),
  })
  if (!row) throw new ApiError(500, "SETTINGS_MISSING", "系统设置尚未初始化")
  return row
}

async function removeLogoFile(deps: AppDeps, logoPath: string | null) {
  if (!logoPath) return
  const filename = path.basename(logoPath)
  await unlink(path.join(deps.config.dataDir, "uploads", filename)).catch(
    () => undefined
  )
}

export function createStatusPageRoutes(deps: AppDeps) {
  return new Hono<AppEnv>()
    .get("/", async (c) => {
      const [appSettings, allMonitors, selected] = await Promise.all([
        currentSettings(deps),
        deps.db.query.monitors.findMany({ orderBy: asc(monitors.name) }),
        deps.db.query.statusPageMonitors.findMany({
          orderBy: asc(statusPageMonitors.sortOrder),
        }),
      ])
      const order = new Map(
        selected.map((row) => [row.monitorId, row.sortOrder])
      )
      return c.json({
        publicEnabled: appSettings.publicEnabled,
        publicShowResponseTime: appSettings.publicShowResponseTime,
        logoPath: appSettings.logoPath,
        monitors: allMonitors.map((monitor) => ({
          id: monitor.id,
          name: monitor.name,
          status: monitor.status,
          selected: order.has(monitor.id),
          sortOrder: order.get(monitor.id) ?? null,
        })),
      })
    })
    .patch("/", async (c) => {
      let raw: unknown
      try {
        raw = await c.req.json()
      } catch {
        throw new ApiError(400, "INVALID_JSON", "请求体必须是有效 JSON")
      }
      const input = statusPageInputSchema.parse(raw)
      if (input.monitorIds.length) {
        const rows = await deps.db
          .select({ id: monitors.id })
          .from(monitors)
          .where(inArray(monitors.id, input.monitorIds))
        if (rows.length !== new Set(input.monitorIds).size) {
          throw new ApiError(
            400,
            "INVALID_MONITOR_IDS",
            "公开页包含不存在的监视器"
          )
        }
      }
      const now = deps.now?.() ?? new Date()
      deps.db.transaction((tx) => {
        tx.update(settings)
          .set({
            publicEnabled: input.publicEnabled,
            publicShowResponseTime: input.publicShowResponseTime,
            updatedAt: now,
          })
          .where(eq(settings.id, 1))
          .run()
        tx.delete(statusPageMonitors).run()
        input.monitorIds.forEach((monitorId, sortOrder) => {
          tx.insert(statusPageMonitors).values({ monitorId, sortOrder }).run()
        })
      })
      return c.json({ ok: true })
    })
    .post("/logo", async (c) => {
      const body = await c.req.parseBody({ all: false })
      const file = body.file
      if (!(file instanceof File)) {
        throw new ApiError(400, "LOGO_REQUIRED", "请选择 Logo 文件")
      }
      if (file.size > 2 * 1024 * 1024) {
        throw new ApiError(400, "LOGO_TOO_LARGE", "Logo 不得超过 2 MiB")
      }
      const bytes = new Uint8Array(await file.arrayBuffer())
      const detected = imageType(bytes)
      if (!detected || file.type !== detected.mime) {
        throw new ApiError(
          400,
          "INVALID_LOGO",
          "仅支持真实的 PNG、JPEG 或 WebP 文件"
        )
      }
      const filename = `logo-${crypto.randomUUID()}.${detected.extension}`
      const destination = path.join(deps.config.dataDir, "uploads", filename)
      await Bun.write(destination, bytes)
      const old = await currentSettings(deps)
      const logoPath = `/uploads/${filename}`
      await deps.db
        .update(settings)
        .set({ logoPath, updatedAt: deps.now?.() ?? new Date() })
        .where(eq(settings.id, 1))
      await removeLogoFile(deps, old.logoPath)
      return c.json({ logoPath }, 201)
    })
    .delete("/logo", async (c) => {
      const old = await currentSettings(deps)
      await deps.db
        .update(settings)
        .set({ logoPath: null, updatedAt: deps.now?.() ?? new Date() })
        .where(eq(settings.id, 1))
      await removeLogoFile(deps, old.logoPath)
      return c.body(null, 204)
    })
}
