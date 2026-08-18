import { motion } from "framer-motion"
import {
  ArrowUpRightIcon,
  CheckIcon,
  CircleAlertIcon,
  Clock3Icon,
} from "lucide-react"
import { Link } from "react-router"
import { useTranslation } from "react-i18next"

import { BrandMark } from "~/components/brand-mark"
import { MonitorCard } from "~/components/monitor-card"
import {
  Reveal,
  staggerContainer,
  staggerItem,
} from "~/components/motion-primitives"
import { UtilityMenus } from "~/components/utility-menus"
import { usePublicStatus } from "~/hooks/use-public-status"
import { Alert, AlertDescription, AlertTitle } from "~/components/ui/alert"
import { Badge } from "~/components/ui/badge"
import { Button } from "~/components/ui/button"
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "~/components/ui/empty"
import { Separator } from "~/components/ui/separator"
import { Skeleton } from "~/components/ui/skeleton"

const globalStatus = {
  operational: {
    labelKey: "allSystemsOperational",
    titleKey: "allGoodTitle",
    icon: CheckIcon,
    variant: "success" as const,
  },
  degraded: {
    labelKey: "someDegraded",
    titleKey: "attentionTitle",
    icon: Clock3Icon,
    variant: "destructive" as const,
  },
  outage: {
    labelKey: "someOutage",
    titleKey: "handlingOutageTitle",
    icon: CircleAlertIcon,
    variant: "destructive" as const,
  },
  pending: {
    labelKey: "collectingStatus",
    titleKey: "statusComingTitle",
    icon: Clock3Icon,
    variant: "outline" as const,
  },
  paused: {
    labelKey: "serviceMaintenance",
    titleKey: "maintenanceTitle",
    icon: Clock3Icon,
    variant: "outline" as const,
  },
} as const

function formatUpdatedAt(value: string, locale: string) {
  return new Intl.DateTimeFormat(locale, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value))
}

export function PublicStatusPage() {
  const { data, error, isLoading, mutate } = usePublicStatus()
  const { t, i18n } = useTranslation()
  if (isLoading) return <PublicLoading />
  if (error) {
    return (
      <main className="flex min-h-svh items-center justify-center px-3 py-6">
        <Alert variant="destructive" className="max-w-lg">
          <CircleAlertIcon aria-hidden="true" />
          <AlertTitle>{t("publicUnavailable")}</AlertTitle>
          <AlertDescription className="flex flex-col gap-3">
            <span>{t("publicUnavailableDescription")}</span>
            <Button variant="outline" size="sm" onClick={() => void mutate()}>
              {t("reload")}
            </Button>
          </AlertDescription>
        </Alert>
      </main>
    )
  }
  if (!data?.enabled) {
    return (
      <main className="flex min-h-svh items-center justify-center px-3 py-6">
        <Empty className="max-w-lg border bg-card">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <Clock3Icon aria-hidden="true" />
            </EmptyMedia>
            <EmptyTitle>{t("publicDisabled")}</EmptyTitle>
            <EmptyDescription>
              {t("publicDisabledDescription")}
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      </main>
    )
  }

  const status = globalStatus[data.globalStatus]
  const StatusIcon = status.icon
  return (
    <main className="min-h-svh overflow-hidden bg-background">
      <header className="sticky top-0 z-40 border-b border-border/70 bg-background/85 backdrop-blur-xl">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-3 py-4 md:px-8">
          <BrandMark logoPath={data.logoPath} siteName={data.siteName} />
          <div className="flex items-center gap-2">
            <UtilityMenus />
            <Button
              variant="outline"
              size="sm"
              asChild
              className="hidden sm:inline-flex"
            >
              <Link to="/app">
                {t("overview")}{" "}
                <ArrowUpRightIcon data-icon="inline-end" aria-hidden="true" />
              </Link>
            </Button>
          </div>
        </div>
      </header>

      <div className="mx-auto flex max-w-6xl flex-col gap-12 px-3 py-8 md:gap-20 md:px-8 md:py-12">
        <motion.section
          className="flex flex-col gap-7 md:gap-8"
          initial="hidden"
          animate="visible"
          variants={staggerContainer}
        >
          <motion.div
            variants={staggerItem}
            className="flex max-w-3xl flex-col gap-5"
          >
            <Badge variant={status.variant}>
              <span
                className="size-1.5 rounded-full bg-primary"
                aria-hidden="true"
              />
              {t(status.labelKey)}
            </Badge>
            <h1 className="font-serif text-4xl leading-tight font-semibold tracking-tight text-balance md:text-6xl md:leading-tight">
              {t(status.titleKey)}
            </h1>
            <p className="max-w-2xl text-base leading-relaxed text-pretty text-muted-foreground md:text-lg">
              {data.siteDescription || t("allGoodTitle")}
            </p>
          </motion.div>
          <motion.div
            variants={staggerItem}
            className="flex flex-col justify-between gap-5 rounded-3xl bg-primary p-5 text-primary-foreground shadow-[0_30px_90px_-45px_var(--primary)] md:flex-row md:items-center md:gap-6 md:p-7"
          >
            <div className="flex items-center gap-4">
              <motion.span
                className="flex size-12 items-center justify-center rounded-2xl bg-primary-foreground/15"
                animate={{ scale: [1, 1.06, 1] }}
                transition={{
                  duration: 2.8,
                  repeat: Infinity,
                  ease: "easeInOut",
                }}
              >
                <StatusIcon className="size-6" aria-hidden="true" />
              </motion.span>
              <div className="flex flex-col gap-1">
                <p className="font-serif text-2xl font-semibold">
                  {data.siteName}
                </p>
                <p className="text-sm text-primary-foreground/75">
                  {t("monitorCount", { count: data.monitors.length })}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 text-sm text-primary-foreground/75">
              <Clock3Icon className="size-4" aria-hidden="true" />
              {t("updatedAt", {
                value: formatUpdatedAt(data.updatedAt, i18n.language),
              })}
            </div>
          </motion.div>
        </motion.section>

        <section
          aria-labelledby="monitors-title"
          className="flex flex-col gap-6 md:gap-8"
        >
          <Reveal>
            <div className="flex flex-col gap-2">
              <p className="text-sm font-medium text-primary">
                {t("availability")}
              </p>
              <h2
                id="monitors-title"
                className="font-serif text-3xl font-semibold tracking-tight md:text-4xl"
              >
                {t("clearServices")}
              </h2>
            </div>
          </Reveal>
          {data.monitors.length === 0 ? (
            <Empty className="min-h-48 border bg-card md:min-h-64">
              <EmptyHeader>
                <EmptyTitle>尚未选择公开监视器</EmptyTitle>
                <EmptyDescription>
                  管理员可以在状态页设置中选择要展示的监视器。
                </EmptyDescription>
              </EmptyHeader>
            </Empty>
          ) : (
            <div className="flex flex-col gap-5">
              {data.monitors.map((monitor, index) => (
                <MonitorCard key={monitor.id} monitor={monitor} index={index} />
              ))}
            </div>
          )}
        </section>

        <section
          aria-labelledby="incidents-title"
          className="flex flex-col gap-6 md:gap-8"
        >
          <Reveal>
            <div className="flex items-end justify-between gap-4">
              <div className="flex flex-col gap-2">
                <p className="text-sm font-medium text-primary">
                  {t("last90Days")}
                </p>
                <h2
                  id="incidents-title"
                  className="font-serif text-3xl font-semibold tracking-tight md:text-4xl"
                >
                  {t("eventRecords")}
                </h2>
              </div>
              <span className="text-sm text-muted-foreground">
                {data.incidents.length}
              </span>
            </div>
          </Reveal>
          {data.incidents.length === 0 ? (
            <Empty className="min-h-48 border bg-card md:min-h-64">
              <EmptyHeader>
                <EmptyMedia variant="icon">
                  <CheckIcon aria-hidden="true" />
                </EmptyMedia>
                <EmptyTitle>近期无事件</EmptyTitle>
                <EmptyDescription>过去 90 天内没有故障记录。</EmptyDescription>
              </EmptyHeader>
            </Empty>
          ) : (
            <div className="flex flex-col">
              {data.incidents.map((incident, index) => (
                <Reveal key={incident.id} delay={index * 0.08}>
                  <article className="grid gap-4 py-5 md:grid-cols-[12rem_1fr_auto] md:items-start md:py-7">
                    <time className="text-sm leading-relaxed text-muted-foreground">
                      {formatUpdatedAt(incident.startedAt, i18n.language)}
                    </time>
                    <div className="flex flex-col gap-2">
                      <h3 className="font-serif text-xl font-semibold">
                        {incident.title}
                      </h3>
                      <p className="max-w-2xl text-sm leading-relaxed text-muted-foreground">
                        {incident.summary} · 持续 {incident.durationSeconds} 秒
                      </p>
                    </div>
                    <Badge
                      variant={
                        incident.resolvedAt ? "secondary" : "destructive"
                      }
                    >
                      {incident.resolvedAt ? "已解决" : "处理中"}
                    </Badge>
                  </article>
                  {index < data.incidents.length - 1 && <Separator />}
                </Reveal>
              ))}
            </div>
          )}
        </section>
      </div>
      <footer className="border-t border-border/70">
        <div className="mx-auto flex max-w-6xl flex-col justify-between gap-3 px-3 py-6 text-sm text-muted-foreground sm:flex-row sm:items-center md:px-8 md:py-8">
          <span>
            © {new Date().getFullYear()} {data.siteName}
          </span>
          <span>{t("transparency")}</span>
        </div>
      </footer>
    </main>
  )
}

function PublicLoading() {
  return (
    <main className="mx-auto flex max-w-6xl flex-col gap-6 px-3 py-8 md:gap-8 md:px-8 md:py-12">
      <Skeleton className="h-8 w-40" />
      <Skeleton className="h-20 w-full max-w-2xl" />
      <Skeleton className="h-52 w-full rounded-3xl" />
      <Skeleton className="h-64 w-full rounded-2xl" />
    </main>
  )
}
