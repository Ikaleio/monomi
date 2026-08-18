import { motion } from "framer-motion"
import { CheckCircle2Icon, CircleAlertIcon, Clock3Icon } from "lucide-react"
import { useTranslation } from "react-i18next"

import { Badge } from "~/components/ui/badge"
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "~/components/ui/card"
import { StatusHistory } from "~/components/status-history"
import type { PublicStatusData } from "~/hooks/use-public-status"

type PublicMonitor = Extract<PublicStatusData, { enabled: true }>["monitors"][number]

const statusMeta = {
  operational: { labelKey: "operational", variant: "success" as const, icon: CheckCircle2Icon },
  degraded: { labelKey: "degraded", variant: "destructive" as const, icon: Clock3Icon },
  outage: { labelKey: "outage", variant: "destructive" as const, icon: CircleAlertIcon },
  pending: { labelKey: "noData", variant: "outline" as const, icon: Clock3Icon },
  paused: { labelKey: "maintenance", variant: "outline" as const, icon: Clock3Icon },
} satisfies Record<PublicMonitor["status"], unknown>

export function MonitorCard({ monitor, index }: { monitor: PublicMonitor; index: number }) {
  const { t } = useTranslation()
  const meta = statusMeta[monitor.status]
  const StatusIcon = meta.icon
  const values = [
    ["最近 24 小时", monitor.uptime24h],
    ["最近 7 天", monitor.uptime7d],
    ["最近 30 天", monitor.uptime30d],
  ] as const
  return (
    <motion.div
      initial={{ opacity: 0, y: 28 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.18 }}
      transition={{ duration: 0.72, delay: index * 0.08, ease: [0.16, 1, 0.3, 1] }}
      whileHover={{ y: -4 }}
    >
      <Card>
        <CardHeader>
          <CardTitle className="font-serif text-xl">{monitor.name}</CardTitle>
          <CardDescription>{monitor.description || "持续检测服务可用性"}</CardDescription>
          <CardAction>
            <Badge variant={meta.variant}>
              <StatusIcon aria-hidden="true" />
              {t(meta.labelKey)}
            </Badge>
          </CardAction>
        </CardHeader>
        <CardContent className="flex flex-col gap-6">
          <dl className="grid grid-cols-3 gap-3 rounded-2xl bg-muted/65 p-4">
            {values.map(([label, value]) => (
              <div key={label} className="flex min-w-0 flex-col gap-1">
                <dt className="truncate text-xs text-muted-foreground">{label}</dt>
                <dd className="text-base font-semibold tabular-nums md:text-lg">
                  {value == null ? "—" : `${value.toFixed(2)}%`}
                </dd>
              </div>
            ))}
          </dl>
          {monitor.responseTimeMs != null && (
            <p className="flex items-center gap-2 text-sm text-muted-foreground">
              <Clock3Icon aria-hidden="true" /> 最近 24 小时平均响应 {monitor.responseTimeMs} ms
            </p>
          )}
          <StatusHistory history={monitor.history} label={monitor.name} />
        </CardContent>
      </Card>
    </motion.div>
  )
}
