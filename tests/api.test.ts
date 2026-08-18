import { afterEach, describe, expect, test } from "bun:test"
import { mkdtemp, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import path from "node:path"

import type { CheckOutcome } from "../server/checks/types"
import { createApp } from "../server/app"
import { parseConfig } from "../server/config"
import { createRuntime, type AppRuntime } from "../server/runtime"

const cleanup: Array<{ directory: string; runtime: AppRuntime }> = []

afterEach(async () => {
  for (const item of cleanup.splice(0)) {
    await item.runtime.stop()
    await rm(item.directory, { recursive: true, force: true })
  }
})

async function harness(outcomes: CheckOutcome[] = [{ success: true, latencyMs: 1 }]) {
  const directory = await mkdtemp(path.join(tmpdir(), "monomi-api-test-"))
  let index = 0
  const sent: Array<Record<string, unknown>> = []
  let now = new Date("2026-08-18T12:00:00Z")
  const runtime = await createRuntime(parseConfig({ MONOMI_DATA_DIR: directory, NODE_ENV: "test" }), {
    now: () => now,
    checker: async () => outcomes[Math.min(index++, outcomes.length - 1)],
    notificationSender: async (_url, _headers, body) => { sent.push(body); return { ok: true, status: 204 } },
  })
  cleanup.push({ directory, runtime })
  return { app: createApp(runtime.deps), runtime, sent, setNow(value: Date) { now = value } }
}

async function setup(app: ReturnType<typeof createApp>) {
  const response = await app.request("/api/setup", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ username: "admin", password: "correct-horse-battery" }) })
  expect(response.status).toBe(201)
  return response.headers.get("set-cookie")?.split(";")[0] ?? ""
}

describe("API behavior", () => {
  test("accepts matching reverse proxy origins and rejects mismatches", async () => {
    const service = await harness()
    const body = JSON.stringify({
      username: "admin",
      password: "correct-horse-battery",
    })
    const proxyHeaders = {
      "Content-Type": "application/json",
      "X-Forwarded-Host": "up.example.com",
      "X-Forwarded-Proto": "https",
    }

    const rejected = await service.app.request("http://127.0.0.1/api/setup", {
      method: "POST",
      headers: { ...proxyHeaders, Origin: "https://other.example.com" },
      body,
    })
    expect(rejected.status).toBe(403)

    const accepted = await service.app.request("http://127.0.0.1/api/setup", {
      method: "POST",
      headers: { ...proxyHeaders, Origin: "https://up.example.com" },
      body,
    })
    expect(accepted.status).toBe(201)
  })

  test("enforces one-time setup, logout, and session expiry", async () => {
    const service = await harness()
    const cookie = await setup(service.app)
    const duplicate = await service.app.request("/api/setup", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ username: "other", password: "correct-horse-battery" }) })
    expect(duplicate.status).toBe(409)
    service.setNow(new Date("2026-09-19T12:00:00Z"))
    const session = await service.app.request("/api/auth/session", { headers: { Cookie: cookie } })
    expect((await session.json()).authenticated).toBe(false)
    const admin = await service.app.request("/api/admin/overview", { headers: { Cookie: cookie } })
    expect(admin.status).toBe(401)
  })

  test("creates one outage and recovery webhook and redacts public data", async () => {
    const service = await harness([
      { success: false, latencyMs: 2, errorCode: "CONNECTION_REFUSED", errorMessage: "private failure" },
      { success: false, latencyMs: 2, errorCode: "CONNECTION_REFUSED", errorMessage: "private failure" },
      { success: true, latencyMs: 3, statusCode: 200 },
    ])
    const cookie = await setup(service.app)
    const jsonHeaders = { Cookie: cookie, "Content-Type": "application/json" }
    const channel = await service.app.request("/api/admin/notifications", { method: "POST", headers: jsonHeaders, body: JSON.stringify({ name: "receiver", url: "http://127.0.0.1/webhook", enabled: true, headers: { Authorization: "secret" }, bodyTemplate: '{"event":"{{event}}","monitor":"{{monitor.name}}"}', monitorIds: null }) })
    expect(channel.status).toBe(201)
    const input = { type: "http", name: "API", description: "public", intervalSeconds: 30, timeoutMs: 1000, failureThreshold: 2, latencyThresholdMs: null, enabled: true, url: "http://private.internal/health", method: "GET", headers: { Authorization: "target-secret" }, body: null, expectedStatusMin: 200, expectedStatusMax: 299, keyword: null, followRedirects: true, validateTls: true }
    const createdResponse = await service.app.request("/api/admin/monitors", { method: "POST", headers: jsonHeaders, body: JSON.stringify(input) })
    const created = await createdResponse.json() as { monitor: { id: string } }
    const runUrl = `/api/admin/monitors/${created.monitor.id}/run`
    expect((await service.app.request(runUrl, { method: "POST", headers: { Cookie: cookie } })).status).toBe(200)
    expect((await service.app.request(runUrl, { method: "POST", headers: { Cookie: cookie } })).status).toBe(200)
    await service.runtime.dispatcher.runDue(new Date("2026-08-18T12:00:00Z"))
    expect((await service.app.request(runUrl, { method: "POST", headers: { Cookie: cookie } })).status).toBe(200)
    await service.runtime.dispatcher.runDue(new Date("2026-08-18T12:00:00Z"))
    expect(service.sent.map((body) => body.event)).toEqual(["outage", "recovery"])
    await service.app.request("/api/admin/status-page", { method: "PATCH", headers: jsonHeaders, body: JSON.stringify({ publicEnabled: true, publicShowResponseTime: true, monitorIds: [created.monitor.id] }) })
    const publicResponse = await service.app.request("/api/public/status")
    const publicText = await publicResponse.text()
    expect(publicResponse.status).toBe(200)
    expect(publicText).not.toContain("private.internal")
    expect(publicText).not.toContain("target-secret")
    expect(publicText).not.toContain("private failure")
  })

  test("regenerates heartbeat token and invalidates the old URL", async () => {
    const service = await harness()
    const cookie = await setup(service.app)
    const input = { type: "heartbeat", name: "Cron", description: "", intervalSeconds: 30, timeoutMs: 1000, failureThreshold: 2, latencyThresholdMs: null, enabled: true, graceSeconds: 5 }
    const createdResponse = await service.app.request("/api/admin/monitors", { method: "POST", headers: { Cookie: cookie, "Content-Type": "application/json" }, body: JSON.stringify(input) })
    const created = await createdResponse.json() as { monitor: { id: string }; heartbeatPath: string }
    expect((await service.app.request(created.heartbeatPath)).status).toBe(204)
    const regenerated = await service.app.request(`/api/admin/monitors/${created.monitor.id}/heartbeat-token`, { method: "POST", headers: { Cookie: cookie } })
    const next = await regenerated.json() as { heartbeatPath: string }
    expect((await service.app.request(created.heartbeatPath)).status).toBe(404)
    expect((await service.app.request(next.heartbeatPath)).status).toBe(204)
  })

  test("rolls back an invalid configuration import", async () => {
    const service = await harness()
    const cookie = await setup(service.app)
    const headers = { Cookie: cookie, "Content-Type": "application/json" }
    const input = { type: "tcp", name: "Preserved", description: "", intervalSeconds: 30, timeoutMs: 1000, failureThreshold: 2, latencyThresholdMs: null, enabled: true, host: "127.0.0.1", port: 80 }
    await service.app.request("/api/admin/monitors", { method: "POST", headers, body: JSON.stringify(input) })
    const exported = await service.app.request("/api/admin/config/export", { headers: { Cookie: cookie } })
    const document = await exported.json() as Record<string, unknown>
    document.notifications = [{ name: "invalid mapping", url: "http://127.0.0.1", enabled: true, headers: {}, bodyTemplate: '{"event":"{{event}}"}', monitorNames: ["Missing"] }]
    const imported = await service.app.request("/api/admin/config/import", { method: "POST", headers, body: JSON.stringify(document) })
    expect(imported.status).toBe(400)
    const monitors = await service.app.request("/api/admin/monitors", { headers: { Cookie: cookie } })
    const payload = await monitors.json() as { monitors: Array<{ name: string }> }
    expect(payload.monitors.map((monitor) => monitor.name)).toEqual(["Preserved"])
  })
})
