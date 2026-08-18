import type { MonitorInput } from "../../shared/contracts"

export function editableMonitor(value: Record<string, unknown>): MonitorInput {
  const common = {
    name: String(value.name),
    description: String(value.description ?? ""),
    intervalSeconds: Number(value.intervalSeconds),
    timeoutMs: Number(value.timeoutMs),
    failureThreshold: Number(value.failureThreshold),
    latencyThresholdMs: value.latencyThresholdMs == null ? null : Number(value.latencyThresholdMs),
    enabled: Boolean(value.enabled),
  }
  if (value.type === "tcp") return { ...common, type: "tcp", host: String(value.host), port: Number(value.port) }
  if (value.type === "heartbeat") return { ...common, type: "heartbeat", graceSeconds: Number(value.graceSeconds) }
  return {
    ...common,
    type: "http",
    url: String(value.url),
    method: value.method === "HEAD" || value.method === "POST" ? value.method : "GET",
    headers: (value.headers ?? {}) as Record<string, string>,
    body: value.body == null ? null : String(value.body),
    expectedStatusMin: Number(value.expectedStatusMin),
    expectedStatusMax: Number(value.expectedStatusMax),
    keyword: value.keyword == null ? null : String(value.keyword),
    followRedirects: Boolean(value.followRedirects),
    validateTls: Boolean(value.validateTls),
  }
}
