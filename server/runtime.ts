import type { AppConfig } from "./config"
import { installPendingRestore } from "./services/backup"
import {
  checkpointAndClose,
  openDatabase,
  resolveSessionSecret,
} from "./db/client"
import { NotificationDispatcher, type NotificationSender } from "./notifications/dispatcher"
import { RetentionService } from "./services/retention"
import { MonitorScheduler, type MonitorChecker } from "./services/scheduler"

export type RuntimeOptions = {
  now?: () => Date
  checker?: MonitorChecker
  notificationSender?: NotificationSender
}
export async function createRuntime(config: AppConfig, options: RuntimeOptions = {}) {
  await installPendingRestore(config)
  const client = await openDatabase(config)
  const sessionSecret = await resolveSessionSecret(config)
  const now = options.now ?? (() => new Date())
  const scheduler = new MonitorScheduler(
    client.db,
    config.checkConcurrency,
    options.checker,
    now,
  )
  const dispatcher = new NotificationDispatcher(
    client.db,
    options.notificationSender,
    now,
  )
  const retention = new RetentionService(client.db, now)

  scheduler.start()
  retention.start()
  dispatcher.start()

  let stopped = false
  return {
    deps: {
      db: client.db,
      config,
      sessionSecret,
      scheduler,
      dispatcher,
      sqlite: client.sqlite,
      now,
    },
    scheduler,
    dispatcher,
    retention,
    async stop() {
      if (stopped) return
      stopped = true
      retention.stop()
      await dispatcher.stop()
      await scheduler.stop()
      checkpointAndClose(client)
    },
  }
}

export type AppRuntime = Awaited<ReturnType<typeof createRuntime>>
