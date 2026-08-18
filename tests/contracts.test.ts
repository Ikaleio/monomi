import { describe, expect, test } from "bun:test"

import { monitorInputSchema } from "../shared/contracts"
import { parseConfig } from "../server/config"

describe("runtime and monitor contracts", () => {
  test("parses explicit false instead of truthy coercion", () => {
    const config = parseConfig({ MONOMI_SECURE_COOKIE: "false", MONOMI_DATA_DIR: "/tmp/monomi-contract" })
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
})
