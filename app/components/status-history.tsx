import { motion } from "framer-motion"
import { useTranslation } from "react-i18next"

import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "~/components/ui/tooltip"
import { cn } from "~/lib/utils"
import type { PublicStatusData } from "~/hooks/use-public-status"

type HistoryDay = Extract<
  PublicStatusData,
  { enabled: true }
>["monitors"][number]["history"][number]

const statusLabels: Record<
  HistoryDay["status"],
  "operational" | "degraded" | "outage" | "noData" | "maintenance"
> = {
  operational: "operational",
  degraded: "degraded",
  outage: "outage",
  pending: "noData",
  paused: "maintenance",
}

const cellClasses: Record<HistoryDay["status"], string> = {
  operational: "bg-primary",
  degraded: "bg-destructive/55",
  outage: "bg-destructive",
  pending: "bg-foreground/15",
  paused: "bg-foreground/25",
}

function formatPublicDate(date: string, locale: string) {
  return new Intl.DateTimeFormat(locale, {
    month: "short",
    day: "numeric",
  }).format(new Date(`${date}T00:00:00Z`))
}

export function StatusHistory({
  history,
  label,
}: {
  history: HistoryDay[]
  label: string
}) {
  const { t, i18n } = useTranslation()
  return (
    <div className="flex flex-col gap-2">
      <div
        className="overflow-x-auto pb-1"
        aria-label={`${label} 最近 90 天状态`}
      >
        <div className="flex min-w-3xl gap-1">
          {history.map((day, index) => (
            <Tooltip key={day.date}>
              <TooltipTrigger asChild>
                <motion.button
                  type="button"
                  aria-label={`${formatPublicDate(day.date, i18n.language)}，${t(statusLabels[day.status])}，${day.uptime == null ? t("noData") : `${day.uptime.toFixed(2)}%`}`}
                  className={cn(
                    "h-7 min-w-1 flex-1 rounded-sm ring-offset-background transition-opacity outline-none hover:opacity-70 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
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
                <span className="font-medium">
                  {formatPublicDate(day.date, i18n.language)}
                </span>
                <span>{t(statusLabels[day.status])}</span>
                <span className="text-background/75">
                  {day.uptime == null
                    ? t("noData")
                    : `${day.uptime.toFixed(2)}%`}{" "}
                  · {day.checks} {t("checks")}
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
