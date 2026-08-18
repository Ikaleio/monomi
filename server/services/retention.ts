import { eq, lt } from "drizzle-orm"

import {
  checks,
  dailyStats,
  notificationDeliveries,
  sessions,
  settings,
} from "../db/schema"
import type { AppDatabase } from "../http/types"

export class RetentionService {
  private timer: Timer | null = null

  constructor(
    private readonly db: AppDatabase,
    private readonly now: () => Date = () => new Date()
  ) {}

  start() {
    if (this.timer) return
    void this.run()
    this.timer = setInterval(() => void this.run(), 24 * 60 * 60 * 1000)
  }

  stop() {
    if (this.timer) clearInterval(this.timer)
    this.timer = null
  }

  run(now = this.now()) {
    const values = this.db
      .select()
      .from(settings)
      .where(eq(settings.id, 1))
      .get()
    if (!values) return
    const rawCutoff = new Date(
      now.getTime() - values.rawRetentionDays * 86400000
    )
    const dailyCutoff = new Date(
      now.getTime() - values.dailyRetentionDays * 86400000
    )
      .toISOString()
      .slice(0, 10)
    const deliveryCutoff = new Date(
      now.getTime() - values.notificationRetentionDays * 86400000
    )
    this.db.transaction((tx) => {
      tx.delete(checks).where(lt(checks.checkedAt, rawCutoff)).run()
      tx.delete(dailyStats).where(lt(dailyStats.date, dailyCutoff)).run()
      tx.delete(sessions).where(lt(sessions.expiresAt, now)).run()
      tx.delete(notificationDeliveries)
        .where(lt(notificationDeliveries.createdAt, deliveryCutoff))
        .run()
    })
  }
}
