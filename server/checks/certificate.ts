import tls from "node:tls"

import type { MonitorInput } from "../../shared/contracts"

export type CertificateOutcome =
  | { success: true; expiresAt: Date }
  | { success: false; error: string }

export function checkCertificate(
  monitor: Extract<MonitorInput, { type: "http" }>,
): Promise<CertificateOutcome> {
  const url = new URL(monitor.url)
  if (url.protocol !== "https:") {
    return Promise.resolve({ success: false, error: "目标不是 HTTPS" })
  }
  return new Promise((resolve) => {
    let settled = false
    const finish = (result: CertificateOutcome) => {
      if (settled) return
      settled = true
      clearTimeout(timer)
      socket.destroy()
      resolve(result)
    }
    const socket = tls.connect({
      host: url.hostname,
      port: Number(url.port || 443),
      servername: url.hostname,
      rejectUnauthorized: monitor.validateTls,
    })
    const timer = setTimeout(
      () => finish({ success: false, error: "证书连接超时" }),
      monitor.timeoutMs,
    )
    socket.once("secureConnect", () => {
      const certificate = socket.getPeerCertificate()
      const expiresAt = new Date(certificate.valid_to)
      if (!certificate.valid_to || Number.isNaN(expiresAt.getTime())) {
        finish({ success: false, error: "证书未提供有效到期时间" })
        return
      }
      finish({ success: true, expiresAt })
    })
    socket.once("error", (error: Error) =>
      finish({ success: false, error: error.message.slice(0, 500) }),
    )
  })
}
