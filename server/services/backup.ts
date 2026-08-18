import { Database } from "bun:sqlite"
import { copyFile, mkdir, readdir, rename, unlink } from "node:fs/promises"
import path from "node:path"

import type { AppConfig } from "../config"

const backupNamePattern = /^monomi-\d{8}-\d{6}\.db$/
const requiredTables = [
  "admins",
  "sessions",
  "settings",
  "monitors",
  "checks",
  "daily_stats",
  "incidents",
  "notification_channels",
  "monitor_notification_channels",
  "notification_deliveries",
  "status_page_monitors",
]

function timestamp(date = new Date()) {
  const compact = date
    .toISOString()
    .replace(/[-:TZ.]/g, "")
    .slice(0, 14)
  return `${compact.slice(0, 8)}-${compact.slice(8)}`
}

export function backupDirectory(config: AppConfig) {
  return path.join(config.dataDir, "backups")
}

export async function createBackup(
  sqlite: Database,
  config: AppConfig,
  prefix = "monomi"
) {
  const directory = backupDirectory(config)
  await mkdir(directory, { recursive: true, mode: 0o700 })
  sqlite.run("PRAGMA wal_checkpoint(PASSIVE)")
  const filename = `${prefix}-${timestamp()}.db`
  await Bun.write(path.join(directory, filename), sqlite.serialize())
  await pruneBackups(config)
  return filename
}

export async function listBackups(config: AppConfig) {
  const entries = await readdir(backupDirectory(config), {
    withFileTypes: true,
  }).catch(() => [])
  return entries
    .filter((entry) => entry.isFile() && backupNamePattern.test(entry.name))
    .map((entry) => entry.name)
    .sort()
    .reverse()
}

export function isSafeBackupFilename(filename: string) {
  return backupNamePattern.test(filename)
}

export async function pruneBackups(config: AppConfig) {
  const entries = await listBackups(config)
  for (const filename of entries.slice(10)) {
    await unlink(path.join(backupDirectory(config), filename)).catch(
      () => undefined
    )
  }
}

export async function validateBackupFile(filePath: string) {
  const sqlite = new Database(filePath, { readonly: true, strict: true })
  try {
    const tableRows = sqlite
      .query<{ name: string }, []>(
        "SELECT name FROM sqlite_master WHERE type = 'table'"
      )
      .all()
    const names = new Set(tableRows.map((row) => row.name))
    if (requiredTables.some((table) => !names.has(table))) return false
    const result = sqlite
      .query<{ integrity_check: string }, []>("PRAGMA integrity_check")
      .get()
    return result?.integrity_check === "ok"
  } finally {
    sqlite.close()
  }
}

export async function stageRestore(config: AppConfig, sourcePath: string) {
  await mkdir(backupDirectory(config), { recursive: true, mode: 0o700 })
  if (!(await validateBackupFile(sourcePath))) {
    throw new Error("备份文件校验失败")
  }
  const pendingPath = path.join(config.dataDir, "restore.pending.sqlite")
  await rename(sourcePath, pendingPath)
  return pendingPath
}

export async function installPendingRestore(config: AppConfig) {
  const pendingPath = path.join(config.dataDir, "restore.pending.sqlite")
  if (!(await Bun.file(pendingPath).exists())) return false
  await mkdir(backupDirectory(config), { recursive: true, mode: 0o700 })

  let valid = false
  try {
    valid = await validateBackupFile(pendingPath)
  } catch (error) {
    console.error(
      "Pending restore validation failed:",
      error instanceof Error ? error.message : "unknown error"
    )
  }
  if (!valid) {
    const failedPath = path.join(
      backupDirectory(config),
      `failed-restore-${timestamp()}.db`
    )
    await rename(pendingPath, failedPath)
    console.error("Pending restore rejected: SQLite validation failed")
    return false
  }

  const currentPath = config.databasePath
  if (await Bun.file(currentPath).exists()) {
    const safetyPath = path.join(
      backupDirectory(config),
      `safety-${timestamp()}.db`
    )
    const current = new Database(currentPath, { readonly: true, strict: true })
    try {
      await Bun.write(safetyPath, current.serialize())
    } finally {
      current.close()
    }
  }
  await unlink(`${currentPath}-wal`).catch(() => undefined)
  await unlink(`${currentPath}-shm`).catch(() => undefined)
  await rename(pendingPath, currentPath)
  return true
}
