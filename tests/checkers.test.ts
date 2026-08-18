import { afterAll, beforeAll, describe, expect, test } from "bun:test"

import type { MonitorInput } from "../shared/contracts"
import { runHttpCheck } from "../server/checks/http"
import { runTcpCheck } from "../server/checks/tcp"

let fixture: ReturnType<typeof Bun.serve>
let baseUrl = ""

beforeAll(() => {
  fixture = Bun.serve({
    hostname: "127.0.0.1",
    port: 0,
    async fetch(request) {
      const path = new URL(request.url).pathname
      if (path === "/redirect") return Response.redirect(new URL("/ok", request.url), 302)
      if (path === "/large") return new Response("x".repeat(1024 * 1024 + 1))
      if (path === "/slow") {
        await Bun.sleep(100)
        return new Response("READY")
      }
      return new Response("READY")
    },
  })
  baseUrl = `http://127.0.0.1:${fixture.port}`
})

afterAll(() => fixture.stop(true))

function httpMonitor(url: string): Extract<MonitorInput, { type: "http" }> {
  return {
    type: "http", name: "fixture", description: "", intervalSeconds: 30,
    timeoutMs: 1000, failureThreshold: 2, latencyThresholdMs: null, enabled: true,
    url, method: "GET", headers: {}, body: null, expectedStatusMin: 200,
    expectedStatusMax: 299, keyword: "READY", followRedirects: true, validateTls: true,
  }
}

describe("bounded checkers", () => {
  test("follows redirects and finds keyword", async () => {
    const outcome = await runHttpCheck(httpMonitor(`${baseUrl}/redirect`))
    expect(outcome.success).toBe(true)
    expect(outcome.statusCode).toBe(200)
  })

  test("enforces keyword and response size", async () => {
    const missing = await runHttpCheck({ ...httpMonitor(`${baseUrl}/ok`), keyword: "MISSING" })
    const large = await runHttpCheck(httpMonitor(`${baseUrl}/large`))
    expect(missing.errorCode).toBe("KEYWORD_MISSING")
    expect(large.errorCode).toBe("RESPONSE_TOO_LARGE")
  })

  test("connects TCP and reports refused ports", async () => {
    const success = await runTcpCheck({ type: "tcp", name: "tcp", description: "", intervalSeconds: 30, timeoutMs: 1000, failureThreshold: 2, latencyThresholdMs: null, enabled: true, host: "127.0.0.1", port: fixture.port! })
    const refused = await runTcpCheck({ type: "tcp", name: "tcp", description: "", intervalSeconds: 30, timeoutMs: 200, failureThreshold: 2, latencyThresholdMs: null, enabled: true, host: "127.0.0.1", port: 1 })
    expect(success.success).toBe(true)
    expect(refused.success).toBe(false)
  })
})
