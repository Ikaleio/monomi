import type { MonitorInput } from "../../shared/contracts"
import type { CheckOutcome } from "./types"

export async function runTcpCheck(
  monitor: Extract<MonitorInput, { type: "tcp" }>,
  signal?: AbortSignal
): Promise<CheckOutcome> {
  const start = performance.now()
  return await new Promise<CheckOutcome>((resolve) => {
    let settled = false
    let socket: { end(): void } | undefined
    const finish = (outcome: CheckOutcome) => {
      if (settled) return
      settled = true
      clearTimeout(timeout)
      signal?.removeEventListener("abort", abort)
      try {
        socket?.end()
      } catch {
        // Socket may already be closed.
      }
      resolve(outcome)
    }
    const failure = (code: CheckOutcome["errorCode"], message: string) =>
      finish({
        success: false,
        latencyMs: Math.max(0, Math.round(performance.now() - start)),
        errorCode: code,
        errorMessage: message.slice(0, 500),
      })
    const abort = () => failure("TIMEOUT", "TCP 检测已取消")
    const timeout = setTimeout(
      () => failure("TIMEOUT", "TCP 连接超时"),
      monitor.timeoutMs
    )
    signal?.addEventListener("abort", abort, { once: true })
    if (signal?.aborted) {
      abort()
      return
    }

    void Bun.connect({
      hostname: monitor.host,
      port: monitor.port,
      socket: {
        data() {},
        open(connected) {
          socket = connected
          finish({
            success: true,
            latencyMs: Math.max(0, Math.round(performance.now() - start)),
          })
        },
        error(_socket, error) {
          const text = error.message.toLowerCase()
          failure(
            text.includes("refused")
              ? "CONNECTION_REFUSED"
              : text.includes("dns")
                ? "DNS_ERROR"
                : "UNKNOWN_ERROR",
            error.message
          )
        },
        close() {
          if (!settled) failure("CONNECTION_REFUSED", "TCP 连接在打开前关闭")
        },
      },
    })
      .then((connected) => {
        socket = connected
      })
      .catch((error: Error) => {
        const text = error.message.toLowerCase()
        failure(
          text.includes("refused")
            ? "CONNECTION_REFUSED"
            : text.includes("dns")
              ? "DNS_ERROR"
              : "UNKNOWN_ERROR",
          error.message
        )
      })
  })
}
