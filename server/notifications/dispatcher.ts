import { and, asc, eq, lte } from "drizzle-orm"

import { headersSchema } from "../../shared/contracts"
import {
  notificationChannels,
  notificationDeliveries,
} from "../db/schema"
import type { AppDatabase } from "../http/types"
import {
  renderWebhookTemplate,
  type WebhookPayload,
} from "./template"

export type NotificationSendResult = {
  ok: boolean
  status?: number
  error?: string
}
export type NotificationSender = (
  url: string,
  headers: Record<string, string>,
  body: Record<string, unknown>,
) => Promise<NotificationSendResult>

export const sendWebhook: NotificationSender = async (url, headers, body) => {
  try {
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...headers },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(10000),
    })
    await response.body?.cancel()
    return response.ok
      ? { ok: true, status: response.status }
      : { ok: false, status: response.status, error: `HTTP ${response.status}` }
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message.slice(0, 500) : "Webhook 发送失败",
    }
  }
}

export class NotificationDispatcher {
  private timer: Timer | null = null
  private dueRun: Promise<void> | null = null

  constructor(
    private readonly db: AppDatabase,
    private readonly sender: NotificationSender = sendWebhook,
    private readonly now: () => Date = () => new Date(),
  ) {}

  start() {
    if (this.timer) return
    this.timer = setInterval(() => void this.runDue(), 1000)
    void this.runDue()
  }

  stop() {
    if (this.timer) clearInterval(this.timer)
    this.timer = null
    return this.dueRun ?? Promise.resolve()
  }

  runDue(now = this.now()): Promise<void> {
    if (this.dueRun) return this.dueRun
    this.dueRun = this.executeDue(now).finally(() => {
      this.dueRun = null
    })
    return this.dueRun
  }

  private async executeDue(now: Date) {
    const due = await this.db
      .select()
      .from(notificationDeliveries)
      .where(
        and(
          eq(notificationDeliveries.status, "pending"),
          lte(notificationDeliveries.nextAttemptAt, now),
        ),
      )
      .orderBy(asc(notificationDeliveries.id))
      .limit(25)
    for (const delivery of due) {
      const channel = await this.db.query.notificationChannels.findFirst({
        where: eq(notificationChannels.id, delivery.channelId),
      })
      if (!channel || !channel.enabled) {
        await this.db
          .update(notificationDeliveries)
          .set({ status: "failed", lastError: "通知渠道不存在或已禁用" })
          .where(eq(notificationDeliveries.id, delivery.id))
        continue
      }
      let payload: WebhookPayload
      let headers: Record<string, string>
      try {
        payload = JSON.parse(delivery.payloadJson) as WebhookPayload
        headers = headersSchema.parse(JSON.parse(channel.headersJson))
      } catch {
        await this.db
          .update(notificationDeliveries)
          .set({ status: "failed", lastError: "已保存的通知数据无效" })
          .where(eq(notificationDeliveries.id, delivery.id))
        continue
      }
      let result: NotificationSendResult
      try {
        const body = renderWebhookTemplate(channel.bodyTemplate, payload)
        result = await this.sender(channel.url, headers, body)
      } catch (error) {
        result = {
          ok: false,
          error: error instanceof Error ? error.message.slice(0, 500) : "模板渲染失败",
        }
      }
      const attempts = delivery.attempts + 1
      if (result.ok) {
        await this.db
          .update(notificationDeliveries)
          .set({
            status: "sent",
            attempts,
            responseStatus: result.status ?? null,
            lastError: null,
            sentAt: now,
          })
          .where(eq(notificationDeliveries.id, delivery.id))
      } else if (attempts >= 3) {
        await this.db
          .update(notificationDeliveries)
          .set({
            status: "failed",
            attempts,
            responseStatus: result.status ?? null,
            lastError: result.error?.slice(0, 500) ?? "Webhook 发送失败",
          })
          .where(eq(notificationDeliveries.id, delivery.id))
      } else {
        const delay = attempts === 1 ? 60000 : 300000
        await this.db
          .update(notificationDeliveries)
          .set({
            attempts,
            nextAttemptAt: new Date(now.getTime() + delay),
            responseStatus: result.status ?? null,
            lastError: result.error?.slice(0, 500) ?? "Webhook 发送失败",
          })
          .where(eq(notificationDeliveries.id, delivery.id))
      }
    }
  }
}
