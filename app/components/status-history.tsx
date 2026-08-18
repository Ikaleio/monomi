import { motion } from "framer-motion"

import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "~/components/ui/tooltip"
import { cn } from "~/lib/utils"
import type { DailyHistory } from "~/data/mock-data"
import { statusLabels } from "~/data/mock-data"

const cellClasses: Record<DailyHistory["status"], string> = {
  operational: "bg-primary",
  degraded: "bg-destructive/55",
  outage: "bg-destructive",
  maintenance: "bg-foreground/20",
}

export function StatusHistory({
  history,
  label,
}: {
  history: DailyHistory[]
  label: string
}) {
  return (
    <div className="flex flex-col gap-3">
      <div
        className="overflow-x-auto pb-2"
        aria-label={`${label} 最近 90 天状态`}
      >
        <div className="flex min-w-3xl gap-1">
          {history.map((day, index) => (
            <Tooltip key={day.date}>
              <TooltipTrigger asChild>
                <motion.button
                  type="button"
                  aria-label={`${day.label}，${statusLabels[day.status]}，可用率 ${day.uptime}%`}
                  className={cn(
                    "h-9 min-w-1 flex-1 rounded-sm ring-offset-background transition-opacity outline-none hover:opacity-70 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                    cellClasses[day.status]
                  )}
                  initial={{ opacity: 0, scaleY: 0.2 }}
                  whileInView={{ opacity: 1, scaleY: 1 }}
                  viewport={{ once: true }}
                  transition={{
                    delay: Math.min(index * 0.008, 0.56),
                    duration: 0.56,
                    type: "spring",
                    bounce: 0.12,
                  }}
                  whileHover={{ y: -5, scaleY: 1.12 }}
                />
              </TooltipTrigger>
              <TooltipContent
                side="top"
                className="flex min-w-52 flex-col items-start gap-1.5 p-3"
              >
                <span className="font-medium">{day.label}</span>
                <span>{statusLabels[day.status]}</span>
                <span className="text-background/75">
                  可用率 {day.uptime.toFixed(2)}% · {day.checks} 次检查
                </span>
              </TooltipContent>
            </Tooltip>
          ))}
        </div>
      </div>
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span>90 天前</span>
        <span>今天</span>
      </div>
    </div>
  )
}
