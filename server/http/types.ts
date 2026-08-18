import type { Database } from "bun:sqlite"
import type { BunSQLiteDatabase } from "drizzle-orm/bun-sqlite"

import type { CheckOutcome } from "../checks/types"
import type { AppConfig } from "../config"
import type * as schema from "../db/schema"

export type AppDatabase = BunSQLiteDatabase<typeof schema>

export type AppEnv = {
  Variables: {
    adminId: string
  }
}

export type SchedulerLike = {
  isRunning(): boolean
  runNow(monitorId: string): Promise<CheckOutcome>
  recordHeartbeat(monitorId: string): Promise<CheckOutcome>
}

export type DispatcherLike = {
  runDue(now?: Date): Promise<void>
}

export type AppDeps = {
  db: AppDatabase
  config: AppConfig
  sessionSecret: string
  scheduler: SchedulerLike
  dispatcher: DispatcherLike
  sqlite: Database
  now?: () => Date
}
