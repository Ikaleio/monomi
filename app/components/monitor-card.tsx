import { motion } from "framer-motion"
import { CheckCircle2Icon } from "lucide-react"

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
import type { Monitor } from "~/data/mock-data"

export function MonitorCard({
  monitor,
  index,
}: {
  monitor: Monitor
  index: number
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 28 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.18 }}
      transition={{
        duration: 0.72,
        delay: index * 0.08,
        ease: [0.16, 1, 0.3, 1],
      }}
      whileHover={{ y: -4 }}
    >
      <Card>
        <CardHeader>
          <CardTitle className="font-serif text-xl">{monitor.name}</CardTitle>
          <CardDescription>{monitor.description}</CardDescription>
          <CardAction>
            <Badge variant="success">
              <CheckCircle2Icon aria-hidden="true" />
              运行正常
            </Badge>
          </CardAction>
        </CardHeader>
        <CardContent className="flex flex-col gap-6">
          <dl className="grid grid-cols-3 gap-3 rounded-2xl bg-muted/65 p-4">
            {[
              ["最近 24 小时", monitor.uptime.day],
              ["最近 7 天", monitor.uptime.week],
              ["最近 30 天", monitor.uptime.month],
            ].map(([label, value]) => (
              <div key={label} className="flex min-w-0 flex-col gap-1">
                <dt className="truncate text-xs text-muted-foreground">
                  {label}
                </dt>
                <dd className="text-base font-semibold tabular-nums md:text-lg">
                  {Number(value).toFixed(2)}%
                </dd>
              </div>
            ))}
          </dl>
          <StatusHistory history={monitor.history} label={monitor.name} />
        </CardContent>
      </Card>
    </motion.div>
  )
}
