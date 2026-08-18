import { Hono } from "hono"
import { rename } from "node:fs/promises"
import path from "node:path"

import { ApiError } from "../http/errors"
import type { AppDeps, AppEnv } from "../http/types"
import {
  backupDirectory,
  createBackup,
  isSafeBackupFilename,
  listBackups,
  stageRestore,
} from "../services/backup"

export function createBackupRoutes(deps: AppDeps) {
  return new Hono<AppEnv>()
    .get("/", async (c) =>
      c.json({
        backups: (await listBackups(deps.config)).map((filename) => ({
          filename,
          downloadPath: `/api/admin/backups/${filename}`,
        })),
      })
    )
    .post("/", async (c) => {
      const filename = await createBackup(deps.sqlite, deps.config)
      return c.json(
        { filename, downloadPath: `/api/admin/backups/${filename}` },
        201
      )
    })
    .get("/:filename", async (c) => {
      const filename = c.req.param("filename")
      if (!isSafeBackupFilename(filename))
        throw new ApiError(404, "BACKUP_NOT_FOUND", "备份不存在")
      const file = Bun.file(path.join(backupDirectory(deps.config), filename))
      if (!(await file.exists()))
        throw new ApiError(404, "BACKUP_NOT_FOUND", "备份不存在")
      return new Response(file, {
        headers: {
          "Content-Type": "application/vnd.sqlite3",
          "Content-Disposition": `attachment; filename="${filename}"`,
        },
      })
    })
    .post("/restore", async (c) => {
      const length = Number(c.req.header("Content-Length") ?? 0)
      if (length > 100 * 1024 * 1024)
        throw new ApiError(413, "BACKUP_TOO_LARGE", "备份不得超过 100 MiB")
      const body = await c.req.parseBody({ all: false })
      const file = body.file
      if (!(file instanceof File))
        throw new ApiError(400, "BACKUP_REQUIRED", "请选择 SQLite 备份")
      if (file.size > 100 * 1024 * 1024)
        throw new ApiError(413, "BACKUP_TOO_LARGE", "备份不得超过 100 MiB")
      const tempPath = path.join(
        deps.config.dataDir,
        "tmp",
        `restore-${crypto.randomUUID()}.sqlite`
      )
      await Bun.write(tempPath, file)
      try {
        await stageRestore(deps.config, tempPath)
      } catch (error) {
        const failedPath = path.join(
          backupDirectory(deps.config),
          `failed-restore-${Date.now()}.db`
        )
        await rename(tempPath, failedPath).catch(() => undefined)
        throw new ApiError(
          400,
          "INVALID_BACKUP",
          error instanceof Error ? error.message : "备份校验失败"
        )
      }
      return c.json({ restartRequired: true }, 202)
    })
}
