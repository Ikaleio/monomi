export type ServiceStatus =
  "operational" | "degraded" | "outage" | "maintenance"

export interface DailyHistory {
  date: string
  label: string
  status: ServiceStatus
  uptime: number
  checks: number
}

export interface Monitor {
  id: string
  name: string
  description: string
  status: ServiceStatus
  uptime: {
    day: number
    week: number
    month: number
  }
  history: DailyHistory[]
}

export interface Incident {
  id: string
  title: string
  time: string
  status: "resolved" | "monitoring" | "maintenance"
  summary: string
}

export interface CertificateStatus {
  id: string
  domain: string
  expiresAt: string
  daysRemaining: number
}

export interface AttentionItem {
  id: string
  title: string
  description: string
  severity: "high" | "medium"
  time: string
}

const baseDate = new Date("2026-08-17T12:00:00Z")

function createHistory(
  checks: number,
  changes: Partial<Record<number, ServiceStatus>> = {}
): DailyHistory[] {
  return Array.from({ length: 90 }, (_, index) => {
    const date = new Date(baseDate)
    date.setUTCDate(baseDate.getUTCDate() - (89 - index))
    const status = changes[index] ?? "operational"
    const uptime =
      status === "operational"
        ? 100
        : status === "maintenance"
          ? 99.95
          : status === "degraded"
            ? 98.72
            : 94.18

    return {
      date: date.toISOString().slice(0, 10),
      label: new Intl.DateTimeFormat("zh-CN", {
        month: "long",
        day: "numeric",
        timeZone: "UTC",
      }).format(date),
      status,
      uptime,
      checks: status === "outage" ? checks - 36 : checks,
    }
  })
}

export const monitors: Monitor[] = [
  {
    id: "api",
    name: "公共 API",
    description: "应用接口与鉴权网关",
    status: "operational",
    uptime: { day: 99.99, week: 99.98, month: 99.96 },
    history: createHistory(1440, {
      71: "degraded",
      72: "outage",
      73: "degraded",
    }),
  },
  {
    id: "console",
    name: "Web 控制台",
    description: "管理后台与公开状态页",
    status: "operational",
    uptime: { day: 100, week: 99.99, month: 99.98 },
    history: createHistory(720, { 54: "maintenance", 55: "maintenance" }),
  },
  {
    id: "edge",
    name: "边缘网络",
    description: "全球加速与静态资源",
    status: "operational",
    uptime: { day: 100, week: 100, month: 99.99 },
    history: createHistory(2880, { 34: "degraded" }),
  },
]

export const incidents: Incident[] = [
  {
    id: "incident-0810",
    title: "华东节点间歇性延迟",
    time: "2026 年 8 月 10 日 · 14:08–14:31",
    status: "resolved",
    summary: "部分 API 请求响应变慢。流量切换后服务恢复，未发生数据丢失。",
  },
  {
    id: "maintenance-0729",
    title: "数据库例行维护",
    time: "2026 年 7 月 29 日 · 02:00–02:18",
    status: "maintenance",
    summary: "按计划完成索引维护，期间控制台出现短暂只读状态。",
  },
]

export const certificates: CertificateStatus[] = [
  {
    id: "cert-api",
    domain: "api.monomi.example",
    expiresAt: "2026-09-05",
    daysRemaining: 19,
  },
]

export const attentionItems: AttentionItem[] = [
  {
    id: "attention-cert",
    title: "API 证书将在 19 天后到期",
    description: "api.monomi.example · 建议在到期前完成续签",
    severity: "medium",
    time: "12 分钟前",
  },
  {
    id: "attention-edge",
    title: "新加坡节点连续检查失败",
    description: "边缘网络 · 已自动切换至备用线路",
    severity: "high",
    time: "18 分钟前",
  },
]

export const systemOverview = {
  status: "operational" as const,
  enabledMonitors: monitors.length,
  successRate24h: 99.99,
  activeIncidents: 0,
  expiringCertificates: certificates.filter(
    (certificate) => certificate.daysRemaining <= 30
  ).length,
  totalChecks24h: 121320,
  updatedAt: "2026 年 8 月 17 日 16:42",
}

export const statusLabels: Record<ServiceStatus, string> = {
  operational: "运行正常",
  degraded: "性能下降",
  outage: "服务中断",
  maintenance: "计划维护",
}
