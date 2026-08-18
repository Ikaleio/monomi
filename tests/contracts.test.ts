import { describe, expect, test } from "bun:test"

import { monitorInputSchema } from "../shared/contracts"
import { parseConfig } from "../server/config"

describe("runtime and monitor contracts", () => {
  test("parses explicit false instead of truthy coercion", () => {
    const config = parseConfig({
      MONOMI_SECURE_COOKIE: "false",
      MONOMI_DATA_DIR: "/tmp/monomi-contract",
    })
    expect(config.secureCookie).toBe(false)
    expect(config.databasePath).toBe("/tmp/monomi-contract/monomi.db")
  })

  test("rejects forbidden request headers", () => {
    const result = monitorInputSchema.safeParse({
      type: "http",
      name: "API",
      description: "",
      intervalSeconds: 60,
      timeoutMs: 1000,
      failureThreshold: 2,
      latencyThresholdMs: null,
      enabled: true,
      url: "http://127.0.0.1/health",
      method: "GET",
      headers: { Host: "elsewhere" },
      body: null,
      expectedStatusMin: 200,
      expectedStatusMax: 299,
      keyword: null,
      followRedirects: true,
      validateTls: true,
    })
    expect(result.success).toBe(false)
  })

  test("enforces environment and monitor input bounds", () => {
    expect(() => parseConfig({ MONOMI_SECURE_COOKIE: "yes" })).toThrow()
    expect(() => parseConfig({ MONOMI_CHECK_CONCURRENCY: "101" })).toThrow()

    const base = {
      type: "http" as const,
      name: "Internal API",
      description: "",
      intervalSeconds: 30,
      timeoutMs: 1000,
      failureThreshold: 2,
      latencyThresholdMs: null,
      enabled: true,
      url: "http://192.168.1.10/health",
      method: "GET" as const,
      headers: {},
      body: null,
      expectedStatusMin: 200,
      expectedStatusMax: 299,
      keyword: null,
      followRedirects: true,
      validateTls: true,
    }
    expect(monitorInputSchema.safeParse(base).success).toBe(true)
    expect(
      monitorInputSchema.safeParse({ ...base, intervalSeconds: 29 }).success
    ).toBe(false)
    expect(
      monitorInputSchema.safeParse({
        ...base,
        url: "http://user:pass@internal/",
      }).success
    ).toBe(false)
    expect(
      monitorInputSchema.safeParse({
        ...base,
        headers: Object.fromEntries(
          Array.from({ length: 33 }, (_, index) => [`X-${index}`, "value"])
        ),
      }).success
    ).toBe(false)
  })
})
