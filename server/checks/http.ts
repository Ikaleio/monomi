import packageJson from "../../package.json"
import type { MonitorInput } from "../../shared/contracts"
import type { CheckErrorCode, CheckOutcome } from "./types"

const MAX_RESPONSE_BYTES = 1024 * 1024

function errorCode(error: unknown, timedOut: boolean): CheckErrorCode {
  if (
    timedOut ||
    (error instanceof DOMException && error.name === "AbortError")
  )
    return "TIMEOUT"
  const message =
    error instanceof Error
      ? `${error.message} ${(error.cause as Error | undefined)?.message ?? ""}`.toLowerCase()
      : ""
  if (
    message.includes("dns") ||
    message.includes("getaddrinfo") ||
    message.includes("name not resolved")
  )
    return "DNS_ERROR"
  if (message.includes("refused") || message.includes("econnrefused"))
    return "CONNECTION_REFUSED"
  if (
    message.includes("tls") ||
    message.includes("certificate") ||
    message.includes("ssl")
  )
    return "TLS_ERROR"
  return "UNKNOWN_ERROR"
}

function fail(
  start: number,
  code: CheckErrorCode,
  message: string,
  statusCode?: number
): CheckOutcome {
  return {
    success: false,
    latencyMs: Math.max(0, Math.round(performance.now() - start)),
    ...(statusCode ? { statusCode } : {}),
    errorCode: code,
    errorMessage: message.slice(0, 500),
  }
}

export async function runHttpCheck(
  monitor: Extract<MonitorInput, { type: "http" }>,
  externalSignal?: AbortSignal
): Promise<CheckOutcome> {
  const start = performance.now()
  const timeout = AbortSignal.timeout(monitor.timeoutMs)
  const signal = externalSignal
    ? AbortSignal.any([timeout, externalSignal])
    : timeout
  let currentUrl = monitor.url
  let method = monitor.method
  let body = monitor.body ?? undefined

  try {
    for (let redirects = 0; redirects <= 5; redirects += 1) {
      const response = await fetch(currentUrl, {
        method,
        headers: {
          ...monitor.headers,
          "User-Agent": `Monomi/${packageJson.version}`,
        },
        body: method === "GET" || method === "HEAD" ? undefined : body,
        redirect: "manual",
        signal,
        tls: { rejectUnauthorized: monitor.validateTls },
      } as RequestInit)

      const location = response.headers.get("location")
      if (
        monitor.followRedirects &&
        location &&
        [301, 302, 303, 307, 308].includes(response.status)
      ) {
        await response.body?.cancel()
        if (redirects === 5) {
          return fail(
            start,
            "TOO_MANY_REDIRECTS",
            "重定向次数超过 5 次",
            response.status
          )
        }
        currentUrl = new URL(location, currentUrl).toString()
        if (
          response.status === 303 ||
          ((response.status === 301 || response.status === 302) &&
            method === "POST")
        ) {
          method = "GET"
          body = undefined
        }
        continue
      }

      if (
        response.status < monitor.expectedStatusMin ||
        response.status > monitor.expectedStatusMax
      ) {
        await response.body?.cancel()
        return fail(
          start,
          "STATUS_MISMATCH",
          `状态码 ${response.status} 不在 ${monitor.expectedStatusMin}-${monitor.expectedStatusMax} 范围内`,
          response.status
        )
      }

      if (monitor.keyword) {
        const reader = response.body?.getReader()
        const decoder = new TextDecoder()
        let text = ""
        let bytes = 0
        if (reader) {
          while (true) {
            const { done, value } = await reader.read()
            if (done) break
            if (bytes + value.byteLength > MAX_RESPONSE_BYTES) {
              await reader.cancel()
              return fail(
                start,
                "RESPONSE_TOO_LARGE",
                "响应正文超过 1 MiB",
                response.status
              )
            }
            bytes += value.byteLength
            text += decoder.decode(value, { stream: true })
          }
          text += decoder.decode()
        }
        if (!text.includes(monitor.keyword)) {
          return fail(
            start,
            "KEYWORD_MISSING",
            "响应中未找到关键字",
            response.status
          )
        }
      } else {
        await response.body?.cancel()
      }
      return {
        success: true,
        latencyMs: Math.max(0, Math.round(performance.now() - start)),
        statusCode: response.status,
      }
    }
  } catch (error) {
    const code = errorCode(error, timeout.aborted)
    const message = error instanceof Error ? error.message : "未知检测错误"
    return fail(start, code, message)
  }
  return fail(start, "UNKNOWN_ERROR", "检测未返回结果")
}
