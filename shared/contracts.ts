import { z } from "zod"

export const monitorTypeSchema = z.enum(["http", "tcp", "heartbeat"])
export const monitorStatusSchema = z.enum([
  "pending",
  "operational",
  "degraded",
  "outage",
  "paused",
])
export const incidentStatusSchema = z.enum(["ongoing", "resolved"])
export const notificationEventSchema = z.enum([
  "outage",
  "recovery",
  "certificate_expiry",
  "test",
])

export type MonitorType = z.infer<typeof monitorTypeSchema>
export type MonitorStatus = z.infer<typeof monitorStatusSchema>
export type IncidentStatus = z.infer<typeof incidentStatusSchema>
export type NotificationEvent = z.infer<typeof notificationEventSchema>

const forbiddenHeaders = new Set([
  "host",
  "content-length",
  "connection",
  "transfer-encoding",
])

export const headersSchema = z
  .record(z.string().min(1).max(128), z.string().max(2048))
  .refine((headers) => Object.keys(headers).length <= 32, "请求头最多 32 项")
  .refine(
    (headers) =>
      Object.keys(headers).every(
        (name) => !forbiddenHeaders.has(name.toLowerCase())
      ),
    "请求头包含不允许覆盖的名称"
  )

const commonMonitorShape = {
  name: z.string().trim().min(1).max(80),
  description: z.string().trim().max(240).default(""),
  intervalSeconds: z.number().int().min(30).max(3600),
  timeoutMs: z.number().int().min(1000).max(30000),
  failureThreshold: z.number().int().min(1).max(5),
  latencyThresholdMs: z
    .number()
    .int()
    .min(100)
    .max(60000)
    .nullable()
    .optional(),
  enabled: z.boolean().default(true),
} as const

const httpMonitorSchema = z
  .object({
    ...commonMonitorShape,
    type: z.literal("http"),
    url: z
      .string()
      .trim()
      .min(1)
      .max(2048)
      .refine((value) => {
        try {
          const url = new URL(value)
          return (
            (url.protocol === "http:" || url.protocol === "https:") &&
            !url.username &&
            !url.password
          )
        } catch {
          return false
        }
      }, "请输入不含凭据的 HTTP(S) URL"),
    method: z.enum(["GET", "HEAD", "POST"]),
    headers: headersSchema.default({}),
    body: z.string().max(65536).nullable().optional(),
    expectedStatusMin: z.number().int().min(100).max(599),
    expectedStatusMax: z.number().int().min(100).max(599),
    keyword: z.string().max(256).nullable().optional(),
    followRedirects: z.boolean(),
    validateTls: z.boolean(),
  })
  .strict()
  .refine((value) => value.expectedStatusMin <= value.expectedStatusMax, {
    path: ["expectedStatusMax"],
    message: "最大状态码不得小于最小状态码",
  })

const tcpMonitorSchema = z
  .object({
    ...commonMonitorShape,
    type: z.literal("tcp"),
    host: z.string().trim().min(1).max(253),
    port: z.number().int().min(1).max(65535),
  })
  .strict()

const heartbeatMonitorSchema = z
  .object({
    ...commonMonitorShape,
    type: z.literal("heartbeat"),
    graceSeconds: z.number().int().min(0).max(86400),
  })
  .strict()

export const monitorInputSchema = z.discriminatedUnion("type", [
  httpMonitorSchema,
  tcpMonitorSchema,
  heartbeatMonitorSchema,
])
export type MonitorInput = z.infer<typeof monitorInputSchema>

export const settingsInputSchema = z
  .object({
    siteName: z.string().trim().min(1).max(80),
    siteDescription: z.string().trim().max(240),
    timezone: z.string().trim().min(1).max(64),
    rawRetentionDays: z.number().int().min(1).max(365),
    dailyRetentionDays: z.number().int().min(30).max(3650),
    notificationRetentionDays: z.number().int().min(1).max(365),
    defaultIntervalSeconds: z.number().int().min(30).max(3600),
    defaultTimeoutMs: z.number().int().min(1000).max(30000),
    defaultFailureThreshold: z.number().int().min(1).max(5),
    certificateWarningDays: z.number().int().min(1).max(90),
    publicEnabled: z.boolean(),
    publicShowResponseTime: z.boolean(),
  })
  .strict()
  .refine(
    (value) => {
      try {
        new Intl.DateTimeFormat("zh-CN", { timeZone: value.timezone }).format()
        return true
      } catch {
        return false
      }
    },
    { path: ["timezone"], message: "无效时区" }
  )
export type SettingsInput = z.infer<typeof settingsInputSchema>

export const webhookInputSchema = z
  .object({
    name: z.string().trim().min(1).max(80),
    url: z
      .string()
      .trim()
      .min(1)
      .max(2048)
      .refine((value) => {
        try {
          const protocol = new URL(value).protocol
          return protocol === "http:" || protocol === "https:"
        } catch {
          return false
        }
      }, "请输入 HTTP(S) URL"),
    enabled: z.boolean().default(true),
    headers: headersSchema.default({}),
    bodyTemplate: z.string().min(2).max(16384),
    monitorIds: z.array(z.string().uuid()).max(500).nullable(),
  })
  .strict()
export type WebhookInput = z.infer<typeof webhookInputSchema>

export const usernameSchema = z
  .string()
  .min(3)
  .max(32)
  .regex(/^[A-Za-z0-9._-]+$/, "用户名只能包含字母、数字、点、下划线或连字符")
export const passwordSchema = z.string().min(12).max(128)
export const setupInputSchema = z
  .object({ username: usernameSchema, password: passwordSchema })
  .strict()
export const loginInputSchema = setupInputSchema
export const passwordChangeSchema = z
  .object({ currentPassword: passwordSchema, newPassword: passwordSchema })
  .strict()

export const paginationSchema = z.object({
  cursor: z.coerce.number().int().positive().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
})

export const statusPageInputSchema = z
  .object({
    publicEnabled: z.boolean(),
    publicShowResponseTime: z.boolean(),
    monitorIds: z.array(z.string().uuid()).max(500),
  })
  .strict()

export const configNotificationSchema = webhookInputSchema
  .omit({ monitorIds: true })
  .extend({
    monitorNames: z.array(z.string().min(1).max(80)).max(500).nullable(),
  })

export const configDocumentSchema = z
  .object({
    schemaVersion: z.literal(1),
    version: z.string(),
    settings: settingsInputSchema,
    monitors: z.array(monitorInputSchema).max(500),
    notifications: z.array(configNotificationSchema).max(100),
    statusPageMonitorNames: z.array(z.string().min(1).max(80)).max(500),
  })
  .strict()
export type ConfigDocument = z.infer<typeof configDocumentSchema>
