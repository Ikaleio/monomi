import { and, eq, lte } from "drizzle-orm"

import type { CheckOutcome } from "../checks/types"
import { runMonitorCheck } from "../checks"
import { checkCertificate } from "../checks/certificate"
import { monitors, type MonitorRow } from "../db/schema"
import { ApiError } from "../http/errors"
import type { AppDatabase, SchedulerLike } from "../http/types"
import { monitorInputFromRow } from "./monitors"
import { recordCertificate, recordOutcome } from "./state"

export type MonitorChecker = (
  monitor: MonitorRow,
  signal?: AbortSignal,
  now?: Date,
) => Promise<CheckOutcome>

export class MonitorScheduler implements SchedulerLike {
  private timer: Timer | null = null
  private running = new Set<string>()
  private active = new Set<Promise<unknown>>()
  private dueRun: Promise<void> | null = null
  private started = false

  constructor(
    private readonly db: AppDatabase,
    private readonly concurrency = 10,
    private readonly checker: MonitorChecker = runMonitorCheck,
    private readonly now: () => Date = () => new Date(),
  ) {}

  isRunning() {
    return this.started
  }

  start() {
    if (this.started) return
    this.started = true
    this.timer = setInterval(() => void this.runDue(), 1000)
    void this.runDue()
  }

  async stop() {
    this.started = false
    if (this.timer) clearInterval(this.timer)
    this.timer = null
    await Promise.allSettled([...this.active])
  }

  runDue(now = this.now()): Promise<void> {
    if (this.dueRun) return this.dueRun
    this.dueRun = this.executeDue(now).finally(() => {
      this.dueRun = null
    })
    return this.dueRun
  }

  private async executeDue(now: Date) {
    const available = Math.max(0, this.concurrency - this.running.size)
    if (available === 0) return
    const selected = this.db.transaction((tx) => {
      const due = tx
        .select()
        .from(monitors)
        .where(
          and(
            eq(monitors.enabled, true),
            lte(monitors.nextCheckAt, now),
          ),
        )
        .all()
        .filter((monitor) => !this.running.has(monitor.id))
        .slice(0, available)
      for (const monitor of due) {
        tx.update(monitors)
          .set({
            nextCheckAt: new Date(now.getTime() + monitor.intervalSeconds * 1000),
            updatedAt: now,
          })
          .where(eq(monitors.id, monitor.id))
          .run()
      }
      return due
    })
    await Promise.all(selected.map((monitor) => this.execute(monitor, now)))
  }

  async runNow(monitorId: string): Promise<CheckOutcome> {
    const monitor = this.db.select().from(monitors).where(eq(monitors.id, monitorId)).get()
    if (!monitor) throw new ApiError(404, "MONITOR_NOT_FOUND", "监视器不存在")
    if (!monitor.enabled) throw new ApiError(409, "MONITOR_PAUSED", "监视器已暂停")
    if (this.running.has(monitorId)) {
      throw new ApiError(409, "CHECK_IN_PROGRESS", "该监视器正在检测")
    }
    return this.execute(monitor, this.now())
  }

  async recordHeartbeat(monitorId: string): Promise<CheckOutcome> {
    const now = this.now()
    const monitor = this.db.select().from(monitors).where(eq(monitors.id, monitorId)).get()
    if (!monitor || monitor.type !== "heartbeat") {
      throw new ApiError(404, "MONITOR_NOT_FOUND", "Heartbeat 监视器不存在")
    }
    const input = monitorInputFromRow(monitor)
    if (input.type !== "heartbeat") {
      throw new ApiError(400, "NOT_HEARTBEAT_MONITOR", "该监视器不是 Heartbeat")
    }
    const outcome: CheckOutcome = { success: true, latencyMs: 0 }
    recordOutcome(this.db, monitorId, outcome, now, { heartbeat: true })
    this.db
      .update(monitors)
      .set({
        nextCheckAt: new Date(
          now.getTime() + (input.intervalSeconds + input.graceSeconds) * 1000,
        ),
        updatedAt: now,
      })
      .where(eq(monitors.id, monitorId))
      .run()
    return outcome
  }

  private execute(monitor: MonitorRow, now: Date): Promise<CheckOutcome> {
    this.running.add(monitor.id)
    const task = this.perform(monitor, now).finally(() => {
      this.running.delete(monitor.id)
      this.active.delete(task)
    })
    this.active.add(task)
    return task
  }

  private async perform(monitor: MonitorRow, now: Date) {
    const controller = new AbortController()
    const outcome = await this.checker(monitor, controller.signal, now)
    recordOutcome(this.db, monitor.id, outcome, now)

    if (
      outcome.success &&
      monitor.type === "http" &&
      (!monitor.certificateCheckedAt ||
        now.getTime() - monitor.certificateCheckedAt.getTime() >= 86400000)
    ) {
      const input = monitorInputFromRow(monitor)
      if (input.type === "http" && new URL(input.url).protocol === "https:") {
        const certificate = await checkCertificate(input)
        recordCertificate(
          this.db,
          monitor.id,
          certificate.success ? certificate.expiresAt : null,
          now,
        )
      }
    }
    return outcome
  }
}
