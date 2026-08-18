import path from "node:path"
import { z } from "zod"

const booleanString = z
  .enum(["true", "false"])
  .default("false")
  .transform((value) => value === "true")

const envSchema = z.object({
  MONOMI_HOST: z.string().min(1).default("0.0.0.0"),
  MONOMI_PORT: z.coerce.number().int().min(1).max(65535).default(3000),
  MONOMI_DATA_DIR: z.string().min(1).default("./data"),
  MONOMI_AUTH_MODE: z.enum(["password", "none"]).default("password"),
  MONOMI_SESSION_SECRET: z.string().min(32).optional(),
  MONOMI_SECURE_COOKIE: booleanString,
  MONOMI_CHECK_CONCURRENCY: z.coerce.number().int().min(1).max(100).default(10),
  NODE_ENV: z
    .enum(["development", "test", "production"])
    .default("development"),
})

export type AppConfig = {
  host: string
  port: number
  dataDir: string
  databasePath: string
  authMode: "password" | "none"
  sessionSecret?: string
  secureCookie: boolean
  checkConcurrency: number
  environment: "development" | "test" | "production"
}

export function parseConfig(
  env: Record<string, string | undefined> = process.env
): AppConfig {
  const parsed = envSchema.parse(env)
  const dataDir = path.resolve(parsed.MONOMI_DATA_DIR)
  return {
    host: parsed.MONOMI_HOST,
    port: parsed.MONOMI_PORT,
    dataDir,
    databasePath: path.join(dataDir, "monomi.db"),
    authMode: parsed.MONOMI_AUTH_MODE,
    sessionSecret: parsed.MONOMI_SESSION_SECRET,
    secureCookie: parsed.MONOMI_SECURE_COOKIE,
    checkConcurrency: parsed.MONOMI_CHECK_CONCURRENCY,
    environment: parsed.NODE_ENV,
  }
}
