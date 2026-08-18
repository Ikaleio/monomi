import { describe, expect, test } from "bun:test"
import { copyFile, mkdtemp, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import path from "node:path"

import { parseConfig } from "../server/config"
import { checkpointAndClose, openDatabase, type DatabaseClient } from "../server/db/client"
import { monitors } from "../server/db/schema"
import { createBackup, installPendingRestore, stageRestore, validateBackupFile } from "../server/services/backup"

function insertMonitor(client: DatabaseClient, id: string, name: string) {
  const now = new Date("2026-08-18T12:00:00Z")
  client.db.insert(monitors).values({ id, type: "tcp", name, description: "", configJson: JSON.stringify({ host: "127.0.0.1", port: 1 }), intervalSeconds: 30, timeoutMs: 1000, failureThreshold: 2, latencyThresholdMs: null, enabled: true, status: "pending", consecutiveFailures: 0, nextCheckAt: now, createdAt: now, updatedAt: now }).run()
}

describe("backup and restore", () => {
  test("validates and installs a staged consistent snapshot", async () => {
    const directory = await mkdtemp(path.join(tmpdir(), "monomi-backup-test-"))
    const config = parseConfig({ MONOMI_DATA_DIR: directory, NODE_ENV: "test" })
    let client = await openDatabase(config)
    try {
      insertMonitor(client, crypto.randomUUID(), "in backup")
      const filename = await createBackup(client.sqlite, config)
      const backupPath = path.join(directory, "backups", filename)
      expect(await validateBackupFile(backupPath)).toBe(true)
      insertMonitor(client, crypto.randomUUID(), "after backup")
      checkpointAndClose(client)
      const uploadPath = path.join(directory, "tmp", "upload.sqlite")
      await copyFile(backupPath, uploadPath)
      await stageRestore(config, uploadPath)
      expect(await installPendingRestore(config)).toBe(true)
      client = await openDatabase(config)
      expect(client.db.select().from(monitors).all().map((monitor) => monitor.name)).toEqual(["in backup"])
    } finally {
      try { checkpointAndClose(client) } catch { /* already closed during restore */ }
      await rm(directory, { recursive: true, force: true })
    }
  })
})
