import { ApiError } from "../http/errors"

const allowedPlaceholders = new Set([
  "event",
  "monitor.name",
  "monitor.status",
  "incident.startedAt",
  "incident.resolvedAt",
  "incident.durationSeconds",
  "check.error",
  "check.latencyMs",
])
const placeholderPattern = /{{\s*([^{}]+?)\s*}}/g

export type WebhookPayload = {
  event: string
  monitor: { name: string; status: string }
  incident: {
    startedAt: Date | string | null
    resolvedAt: Date | string | null
    durationSeconds: number | null
  }
  check: { error: string | null; latencyMs: number | null }
}

function valueAt(payload: WebhookPayload, path: string) {
  const [first, second] = path.split(".")
  if (!second) return payload[first as keyof WebhookPayload]
  const parent = payload[first as "monitor" | "incident" | "check"]
  return (parent as Record<string, unknown>)[second]
}

export function validateWebhookTemplate(template: string) {
  try {
    JSON.parse(template)
  } catch {
    throw new ApiError(400, "INVALID_WEBHOOK_TEMPLATE", "Webhook 模板必须是有效 JSON")
  }
  for (const match of template.matchAll(placeholderPattern)) {
    if (!allowedPlaceholders.has(match[1])) {
      throw new ApiError(
        400,
        "INVALID_WEBHOOK_PLACEHOLDER",
        `不支持的模板变量：${match[1]}`,
      )
    }
  }
  renderWebhookTemplate(template, {
    event: "test",
    monitor: { name: "示例服务", status: "operational" },
    incident: { startedAt: new Date(0), resolvedAt: null, durationSeconds: 0 },
    check: { error: "", latencyMs: 1 },
  })
}

export function renderWebhookTemplate(template: string, payload: WebhookPayload) {
  const rendered = template.replace(placeholderPattern, (_match, path: string) => {
    if (!allowedPlaceholders.has(path)) {
      throw new ApiError(
        400,
        "INVALID_WEBHOOK_PLACEHOLDER",
        `不支持的模板变量：${path}`,
      )
    }
    const value = valueAt(payload, path)
    const text = value instanceof Date ? value.toISOString() : value == null ? "" : String(value)
    return JSON.stringify(text).slice(1, -1)
  })
  try {
    return JSON.parse(rendered) as Record<string, unknown>
  } catch {
    throw new ApiError(
      400,
      "INVALID_WEBHOOK_TEMPLATE",
      "替换变量后的 Webhook 模板不是有效 JSON",
    )
  }
}
