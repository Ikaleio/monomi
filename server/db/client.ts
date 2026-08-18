import { Database } from "bun:sqlite"
import { chmod, mkdir, readFile, writeFile } from "node:fs/promises"
import path from "node:path"
import { drizzle, type BunSQLiteDatabase } from "drizzle-orm/bun-sqlite"
import { migrate } from "drizzle-orm/bun-sqlite/migrator"

import type { AppConfig } from "../config"
import * as schema from "./schema"

export type DatabaseClient = {
  sqlite: Database
  db: BunSQLiteDatabase<typeof schema>
}

export async function ensureDataDirectories(dataDir: string) {
  await Promise.all(
    [dataDir, "uploads", "backups", "tmp"].map((entry) =>
      mkdir(entry === dataDir ? entry : path.join(dataDir, entry), {
        recursive: true,
        mode: 0o700,
      }),
    ),
  )
}

export async function openDatabase(config: AppConfig): Promise<DatabaseClient> {
  await ensureDataDirectories(config.dataDir)
  const sqlite = new Database(config.databasePath, {
    create: true,
    strict: true,
  })
  sqlite.run("PRAGMA foreign_keys = ON")
  sqlite.run("PRAGMA journal_mode = WAL")
  sqlite.run("PRAGMA busy_timeout = 5000")
  const db = drizzle(sqlite, { schema })
  migrate(db, { migrationsFolder: path.resolve(import.meta.dir, "../../drizzle") })
  await seedDefaultSettings(db)
  return { sqlite, db }
}

export async function seedDefaultSettings(db: DatabaseClient["db"]) {
  let timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC"
  try {
    new Intl.DateTimeFormat("zh-CN", { timeZone: timezone }).format()
  } catch {
    timezone = "UTC"
  }
  await db
    .insert(schema.settings)
    .values({
      id: 1,
      siteName: "Monomi Status",
      siteDescription: "",
      timezone,
      rawRetentionDays: 30,
      dailyRetentionDays: 365,
      notificationRetentionDays: 30,
      defaultIntervalSeconds: 60,
      defaultTimeoutMs: 10000,
      defaultFailureThreshold: 2,
      certificateWarningDays: 30,
      publicEnabled: false,
      publicShowResponseTime: true,
    })
    .onConflictDoNothing()
}

export async function resolveSessionSecret(config: AppConfig): Promise<string> {
  if (config.sessionSecret) return config.sessionSecret
  await ensureDataDirectories(config.dataDir)
  const secretPath = path.join(config.dataDir, "session-secret")
  try {
    const existing = (await readFile(secretPath, "utf8")).trim()
    if (existing.length >= 32) return existing
  } catch (error) {
    if (!(error instanceof Error && "code" in error && error.code === "ENOENT")) {
      throw error
    }
  }
  const secret = Buffer.from(crypto.getRandomValues(new Uint8Array(32))).toString(
    "base64url",
  )
  await writeFile(secretPath, `${secret}\n`, { mode: 0o600, flag: "wx" }).catch(
    async (error) => {
      if (error instanceof Error && "code" in error && error.code === "EEXIST") {
        return
      }
      throw error
    },
  )
  await chmod(secretPath, 0o600)
  return (await readFile(secretPath, "utf8")).trim()
}

export function checkpointAndClose(client: DatabaseClient) {
  client.sqlite.run("PRAGMA wal_checkpoint(TRUNCATE)")
  client.sqlite.close()
}
