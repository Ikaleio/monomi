import { sql } from "drizzle-orm"
import {
  index,
  integer,
  primaryKey,
  sqliteTable,
  text,
  uniqueIndex,
} from "drizzle-orm/sqlite-core"

import type {
  IncidentStatus,
  MonitorStatus,
  MonitorType,
  NotificationEvent,
} from "../../shared/contracts"

const createdAt = () =>
  integer("created_at", { mode: "timestamp_ms" }).notNull().$defaultFn(() => new Date())
const updatedAt = () =>
  integer("updated_at", { mode: "timestamp_ms" }).notNull().$defaultFn(() => new Date()).$onUpdate(() => new Date())

export const admins = sqliteTable("admins", {
  id: text("id").primaryKey(),
  username: text("username").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
})

export const sessions = sqliteTable(
  "sessions",
  {
    tokenHash: text("token_hash").primaryKey(),
    adminId: text("admin_id")
      .notNull()
      .references(() => admins.id, { onDelete: "cascade" }),
    expiresAt: integer("expires_at", { mode: "timestamp_ms" }).notNull(),
    createdAt: createdAt(),
  },
  (table) => [index("sessions_expires_idx").on(table.expiresAt)],
)

export const settings = sqliteTable("settings", {
  id: integer("id").primaryKey(),
  siteName: text("site_name").notNull(),
  siteDescription: text("site_description").notNull(),
  timezone: text("timezone").notNull(),
  rawRetentionDays: integer("raw_retention_days").notNull(),
  dailyRetentionDays: integer("daily_retention_days").notNull(),
  notificationRetentionDays: integer("notification_retention_days").notNull(),
  defaultIntervalSeconds: integer("default_interval_seconds").notNull(),
  defaultTimeoutMs: integer("default_timeout_ms").notNull(),
  defaultFailureThreshold: integer("default_failure_threshold").notNull(),
  certificateWarningDays: integer("certificate_warning_days").notNull(),
  publicEnabled: integer("public_enabled", { mode: "boolean" }).notNull(),
  publicShowResponseTime: integer("public_show_response_time", { mode: "boolean" }).notNull(),
  logoPath: text("logo_path"),
  updatedAt: updatedAt(),
})

export const monitors = sqliteTable(
  "monitors",
  {
    id: text("id").primaryKey(),
    type: text("type").notNull().$type<MonitorType>(),
    name: text("name").notNull(),
    description: text("description").notNull(),
    configJson: text("config_json").notNull(),
    intervalSeconds: integer("interval_seconds").notNull(),
    timeoutMs: integer("timeout_ms").notNull(),
    failureThreshold: integer("failure_threshold").notNull(),
    latencyThresholdMs: integer("latency_threshold_ms"),
    heartbeatTokenHash: text("heartbeat_token_hash").unique(),
    enabled: integer("enabled", { mode: "boolean" }).notNull(),
    status: text("status").notNull().$type<MonitorStatus>(),
    consecutiveFailures: integer("consecutive_failures").notNull().default(0),
    nextCheckAt: integer("next_check_at", { mode: "timestamp_ms" }),
    lastCheckAt: integer("last_check_at", { mode: "timestamp_ms" }),
    lastSuccessAt: integer("last_success_at", { mode: "timestamp_ms" }),
    lastHeartbeatAt: integer("last_heartbeat_at", { mode: "timestamp_ms" }),
    certificateExpiresAt: integer("certificate_expires_at", { mode: "timestamp_ms" }),
    certificateCheckedAt: integer("certificate_checked_at", { mode: "timestamp_ms" }),
    certificateNotifiedForExpiry: integer("certificate_notified_for_expiry", {
      mode: "timestamp_ms",
    }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => [
    index("monitors_due_idx").on(table.enabled, table.nextCheckAt),
    index("monitors_certificate_idx").on(table.certificateExpiresAt),
  ],
)

export const checks = sqliteTable(
  "checks",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    monitorId: text("monitor_id")
      .notNull()
      .references(() => monitors.id, { onDelete: "cascade" }),
    success: integer("success", { mode: "boolean" }).notNull(),
    latencyMs: integer("latency_ms").notNull(),
    statusCode: integer("status_code"),
    errorCode: text("error_code"),
    errorMessage: text("error_message"),
    checkedAt: integer("checked_at", { mode: "timestamp_ms" }).notNull(),
  },
  (table) => [index("checks_monitor_time_idx").on(table.monitorId, table.checkedAt)],
)

export const dailyStats = sqliteTable(
  "daily_stats",
  {
    monitorId: text("monitor_id")
      .notNull()
      .references(() => monitors.id, { onDelete: "cascade" }),
    date: text("date").notNull(),
    checkCount: integer("check_count").notNull().default(0),
    successCount: integer("success_count").notNull().default(0),
    latencyTotalMs: integer("latency_total_ms").notNull().default(0),
    latencyMinMs: integer("latency_min_ms"),
    latencyMaxMs: integer("latency_max_ms"),
    worstStatus: text("worst_status").notNull().$type<MonitorStatus>(),
  },
  (table) => [primaryKey({ columns: [table.monitorId, table.date] })],
)

export const incidents = sqliteTable(
  "incidents",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    monitorId: text("monitor_id")
      .notNull()
      .references(() => monitors.id, { onDelete: "cascade" }),
    status: text("status").notNull().$type<IncidentStatus>(),
    startedAt: integer("started_at", { mode: "timestamp_ms" }).notNull(),
    resolvedAt: integer("resolved_at", { mode: "timestamp_ms" }),
    resolution: text("resolution"),
    createdAt: createdAt(),
  },
  (table) => [
    uniqueIndex("incidents_one_ongoing_idx")
      .on(table.monitorId)
      .where(sql`${table.status} = 'ongoing'`),
    index("incidents_status_id_idx").on(table.status, table.id),
    index("incidents_monitor_time_idx").on(table.monitorId, table.startedAt),
  ],
)

export const notificationChannels = sqliteTable("notification_channels", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  url: text("url").notNull(),
  headersJson: text("headers_json").notNull(),
  bodyTemplate: text("body_template").notNull(),
  enabled: integer("enabled", { mode: "boolean" }).notNull(),
  allMonitors: integer("all_monitors", { mode: "boolean" }).notNull(),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
})

export const monitorNotificationChannels = sqliteTable(
  "monitor_notification_channels",
  {
    monitorId: text("monitor_id")
      .notNull()
      .references(() => monitors.id, { onDelete: "cascade" }),
    channelId: text("channel_id")
      .notNull()
      .references(() => notificationChannels.id, { onDelete: "cascade" }),
  },
  (table) => [primaryKey({ columns: [table.monitorId, table.channelId] })],
)

export const notificationDeliveries = sqliteTable(
  "notification_deliveries",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    channelId: text("channel_id")
      .notNull()
      .references(() => notificationChannels.id, { onDelete: "cascade" }),
    monitorId: text("monitor_id")
      .references(() => monitors.id, { onDelete: "cascade" }),
    incidentId: integer("incident_id").references(() => incidents.id, {
      onDelete: "cascade",
    }),
    eventType: text("event_type").notNull().$type<NotificationEvent>(),
    status: text("status").notNull().$type<"pending" | "sent" | "failed">(),
    attempts: integer("attempts").notNull().default(0),
    nextAttemptAt: integer("next_attempt_at", { mode: "timestamp_ms" }).notNull(),
    lastError: text("last_error"),
    responseStatus: integer("response_status"),
    payloadJson: text("payload_json").notNull(),
    sentAt: integer("sent_at", { mode: "timestamp_ms" }),
    dedupeKey: text("dedupe_key").notNull(),
    createdAt: createdAt(),
  },
  (table) => [
    uniqueIndex("notification_deliveries_dedupe_idx").on(table.dedupeKey),
    index("notification_deliveries_due_idx").on(table.status, table.nextAttemptAt),
    index("notification_deliveries_created_idx").on(table.createdAt),
  ],
)

export const statusPageMonitors = sqliteTable("status_page_monitors", {
  monitorId: text("monitor_id")
    .primaryKey()
    .references(() => monitors.id, { onDelete: "cascade" }),
  sortOrder: integer("sort_order").notNull(),
})

export type MonitorRow = typeof monitors.$inferSelect
export type CheckRow = typeof checks.$inferSelect
export type SettingsRow = typeof settings.$inferSelect
