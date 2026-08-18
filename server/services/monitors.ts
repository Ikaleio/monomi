import type { MonitorInput } from "../../shared/contracts"
import { monitorInputSchema } from "../../shared/contracts"
import type { MonitorRow } from "../db/schema"

const commonKeys = new Set([
  "type",
  "name",
  "description",
  "intervalSeconds",
  "timeoutMs",
  "failureThreshold",
  "latencyThresholdMs",
  "enabled",
])

export function monitorConfig(input: MonitorInput) {
  return Object.fromEntries(
    Object.entries(input).filter(([key]) => !commonKeys.has(key))
  )
}

export function monitorInputFromRow(row: MonitorRow): MonitorInput {
  const config = JSON.parse(row.configJson) as Record<string, unknown>
  return monitorInputSchema.parse({
    type: row.type,
    name: row.name,
    description: row.description,
    intervalSeconds: row.intervalSeconds,
    timeoutMs: row.timeoutMs,
    failureThreshold: row.failureThreshold,
    latencyThresholdMs: row.latencyThresholdMs,
    enabled: row.enabled,
    ...config,
  })
}

export function monitorView(row: MonitorRow) {
  const input = monitorInputFromRow(row)
  return {
    id: row.id,
    ...input,
    status: row.status,
    consecutiveFailures: row.consecutiveFailures,
    nextCheckAt: row.nextCheckAt,
    lastCheckAt: row.lastCheckAt,
    lastSuccessAt: row.lastSuccessAt,
    lastHeartbeatAt: row.lastHeartbeatAt,
    certificateExpiresAt: row.certificateExpiresAt,
    certificateCheckedAt: row.certificateCheckedAt,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  }
}
