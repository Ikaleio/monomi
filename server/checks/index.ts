import type { MonitorRow } from "../db/schema"
import { monitorInputFromRow } from "../services/monitors"
import { runHttpCheck } from "./http"
import { runTcpCheck } from "./tcp"
import type { CheckOutcome } from "./types"

export async function runMonitorCheck(
  row: MonitorRow,
  signal?: AbortSignal,
  now = new Date(),
): Promise<CheckOutcome> {
  const monitor = monitorInputFromRow(row)
  switch (monitor.type) {
    case "http":
      return runHttpCheck(monitor, signal)
    case "tcp":
      return runTcpCheck(monitor, signal)
    case "heartbeat": {
      const lastSignal = row.lastHeartbeatAt ?? row.createdAt
      const deadline =
        lastSignal.getTime() +
        (monitor.intervalSeconds + monitor.graceSeconds) * 1000
      if (now.getTime() <= deadline) return { success: true, latencyMs: 0 }
      return {
        success: false,
        latencyMs: 0,
        errorCode: "TIMEOUT",
        errorMessage: "未在预期时间内收到 Heartbeat",
      }
    }
  }
}
