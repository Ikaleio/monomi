import { motion } from "framer-motion"
import {
  ActivityIcon,
  AlertTriangleIcon,
  ArrowUpRightIcon,
  CheckCircle2Icon,
  Clock3Icon,
  PlusIcon,
  RefreshCwIcon,
  ServerIcon,
  ShieldCheckIcon,
} from "lucide-react"
import { Link } from "react-router"

import { VirtualList } from "~/components/virtual-list"
import {
  Reveal,
  staggerContainer,
  staggerItem,
} from "~/components/motion-primitives"
import { Alert, AlertDescription, AlertTitle } from "~/components/ui/alert"
import { Badge } from "~/components/ui/badge"
import { Button } from "~/components/ui/button"
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "~/components/ui/card"
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "~/components/ui/empty"
import { Separator } from "~/components/ui/separator"
import { Skeleton } from "~/components/ui/skeleton"
import { useOverview } from "~/hooks/use-overview"

const statusText = {
  operational: "运行正常",
  degraded: "性能下降",
  outage: "服务中断",
  pending: "等待检查",
  paused: "计划维护",
} as const

function StatusBadge({ status }: { status: keyof typeof statusText }) {
  const variant =
    status === "operational"
      ? "success"
      : status === "outage" || status === "degraded"
        ? "destructive"
        : "outline"
  return <Badge variant={variant}>{statusText[status]}</Badge>
}

export function OverviewDashboard() {
  const { data, error, isLoading, mutate } = useOverview()
  if (isLoading) return <OverviewSkeleton />
  if (error || !data)
    return (
      <main className="mx-auto w-full max-w-7xl px-3 py-4 md:px-6 md:py-5">
        <Alert variant="destructive">
          <AlertTriangleIcon aria-hidden="true" />
          <AlertTitle>总览暂时不可用</AlertTitle>
          <AlertDescription className="flex flex-col gap-3">
            <span>
              {error instanceof Error ? error.message : "请稍后重试。"}
            </span>
            <Button variant="outline" size="sm" onClick={() => void mutate()}>
              重新加载
            </Button>
          </AlertDescription>
        </Alert>
      </main>
    )

  const stats = [
    {
      label: "24 小时检查成功率",
      value: data.uptime24h == null ? "—" : `${data.uptime24h.toFixed(2)}%`,
      detail: `${data.checkCount24h.toLocaleString("zh-CN")} 次检查`,
      icon: ActivityIcon,
    },
    {
      label: "启用监视器",
      value: `${data.enabledCount}`,
      detail: "持续检测中",
      icon: ServerIcon,
    },
    {
      label: "当前故障",
      value: `${data.outageCount}`,
      detail: data.outageCount ? "需要处理" : "无进行中故障",
      icon: CheckCircle2Icon,
    },
    {
      label: "即将到期证书",
      value: `${data.expiringCertificateCount}`,
      detail: "请安排续签",
      icon: ShieldCheckIcon,
    },
  ]
  return (
    <main className="mx-auto flex w-full max-w-7xl flex-col gap-5 px-3 py-4 md:gap-6 md:px-6 md:py-6">
      <motion.section
        initial="hidden"
        animate="visible"
        variants={staggerContainer}
        className="flex flex-col gap-5"
      >
        <motion.div
          variants={staggerItem}
          className="flex flex-col justify-between gap-3 md:flex-row md:items-end"
        >
          <div className="flex max-w-2xl flex-col gap-2">
            <p className="text-sm font-medium text-primary">运行总览</p>
            <h1 className="font-serif text-4xl font-semibold tracking-tight text-balance md:text-5xl">
              今天，
              {data.globalStatus === "operational"
                ? "一切稳定。"
                : "需要关注状态。"}
            </h1>
            <p className="text-sm leading-relaxed text-muted-foreground md:text-base">
              汇总当前启用的监视器，以及最近 24 小时内的服务表现。
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={() => void mutate()}>
              <RefreshCwIcon data-icon="inline-start" aria-hidden="true" />
              刷新
            </Button>
            <Button asChild>
              <Link to="/app/monitors/new">
                <PlusIcon data-icon="inline-start" aria-hidden="true" />
                新建监视器
              </Link>
            </Button>
          </div>
        </motion.div>
        <motion.div
          variants={staggerItem}
          className="grid overflow-hidden rounded-2xl bg-primary text-primary-foreground shadow-[0_28px_80px_-44px_var(--primary)] lg:grid-cols-[1.3fr_1fr]"
        >
          <div className="flex flex-col justify-between gap-4 p-4 md:gap-5 md:p-5">
            <div className="flex items-start justify-between gap-4">
              <div className="flex flex-col gap-2">
                <span className="text-sm text-primary-foreground/70">
                  全局服务状态
                </span>
                <h2 className="font-serif text-3xl font-semibold md:text-4xl">
                  {statusText[data.globalStatus]}
                </h2>
              </div>
              <span className="flex size-10 items-center justify-center rounded-xl bg-primary-foreground/15">
                <ActivityIcon className="size-5" aria-hidden="true" />
              </span>
            </div>
            <div className="flex items-end gap-3">
              <span className="font-serif text-5xl font-semibold tracking-tight tabular-nums md:text-6xl">
                {data.uptime24h == null ? "—" : data.uptime24h.toFixed(2)}
              </span>
              <span className="pb-2 text-lg text-primary-foreground/75">%</span>
            </div>
            <p className="text-sm text-primary-foreground/70">
              最近 24 小时整体检查成功率
            </p>
          </div>
          <div className="grid grid-cols-2 border-t border-primary-foreground/15 lg:border-t-0 lg:border-l">
            {[
              ["启用监视器", data.enabledCount, "个"],
              ["当前故障", data.outageCount, "个"],
              ["检查总数", data.checkCount24h.toLocaleString("zh-CN"), "次"],
              [
                "平均延迟",
                data.averageLatencyMs == null ? "—" : data.averageLatencyMs,
                "ms",
              ],
            ].map(([label, value, suffix], index) => (
              <motion.div
                key={label}
                className={`flex min-h-24 flex-col justify-between border-primary-foreground/15 p-4 odd:border-r md:min-h-28 md:p-5 ${index < 2 ? "border-b" : ""}`}
                initial={{ opacity: 0, scale: 0.94 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{
                  delay: 0.32 + index * 0.08,
                  type: "spring",
                  stiffness: 160,
                  damping: 18,
                }}
              >
                <span className="text-xs text-primary-foreground/65">
                  {label}
                </span>
                <span className="text-2xl font-semibold tabular-nums">
                  {value}
                  <small className="text-sm font-normal text-primary-foreground/65">
                    {suffix}
                  </small>
                </span>
              </motion.div>
            ))}
          </div>
        </motion.div>
      </motion.section>

      <section aria-labelledby="stats-title" className="flex flex-col gap-4">
        <Reveal>
          <h2 id="stats-title" className="font-serif text-2xl font-semibold">
            核心统计
          </h2>
        </Reveal>
        <motion.div
          className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4"
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, amount: 0.2 }}
          variants={staggerContainer}
        >
          {stats.map((stat) => (
            <motion.div key={stat.label} variants={staggerItem}>
              <Card className="h-full">
                <CardHeader>
                  <CardDescription>{stat.label}</CardDescription>
                  <CardAction>
                    <span className="flex size-9 items-center justify-center rounded-xl bg-muted text-muted-foreground">
                      <stat.icon className="size-4" aria-hidden="true" />
                    </span>
                  </CardAction>
                </CardHeader>
                <CardContent className="flex flex-col gap-2">
                  <strong className="text-3xl font-semibold tracking-tight tabular-nums">
                    {stat.value}
                  </strong>
                  <span className="text-xs text-muted-foreground">
                    {stat.detail}
                  </span>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </motion.div>
      </section>

      <section
        aria-labelledby="monitor-summary-title"
        className="grid gap-4 xl:grid-cols-[1.35fr_1fr]"
      >
        <Reveal className="min-w-0">
          <Card className="h-full">
            <CardHeader>
              <CardTitle
                id="monitor-summary-title"
                className="font-serif text-2xl"
              >
                监视器
              </CardTitle>
              <CardDescription>当前项目的即时状态</CardDescription>
              <CardAction>
                <Button variant="ghost" size="sm" asChild>
                  <Link to="/app/monitors">
                    查看全部{" "}
                    <ArrowUpRightIcon
                      data-icon="inline-end"
                      aria-hidden="true"
                    />
                  </Link>
                </Button>
              </CardAction>
            </CardHeader>
            <CardContent>
              {data.monitors.length === 0 ? (
                <Empty className="min-h-40">
                  <EmptyHeader>
                    <EmptyMedia variant="icon">
                      <ServerIcon aria-hidden="true" />
                    </EmptyMedia>
                    <EmptyTitle>还没有监视器</EmptyTitle>
                    <EmptyDescription>
                      创建第一个监视器开始检测。
                    </EmptyDescription>
                  </EmptyHeader>
                </Empty>
              ) : (
                <VirtualList
                  items={data.monitors}
                  estimateSize={64}
                  getKey={(item) => item.id}
                  renderItem={(monitor, index) => (
                    <div className="px-1">
                      <Link
                        to={`/app/monitors/${monitor.id}`}
                        className="flex items-center justify-between gap-4 rounded-xl py-3 outline-none hover:bg-muted/50 focus-visible:ring-2 focus-visible:ring-ring"
                      >
                        <div className="flex min-w-0 items-center gap-3">
                          <span
                            className={`size-2 shrink-0 rounded-full ${monitor.status === "operational" ? "bg-primary" : "bg-destructive"}`}
                            aria-hidden="true"
                          />
                          <div className="flex min-w-0 flex-col gap-1">
                            <span className="truncate font-medium">
                              {monitor.name}
                            </span>
                            <span className="truncate text-xs text-muted-foreground">
                              {monitor.description || "无描述"}
                            </span>
                          </div>
                        </div>
                        <StatusBadge status={monitor.status} />
                      </Link>
                      {index < data.monitors.length - 1 && <Separator />}
                    </div>
                  )}
                />
              )}
            </CardContent>
          </Card>
        </Reveal>
        <Reveal delay={0.1} className="min-w-0">
          <Card className="h-full">
            <CardHeader>
              <CardTitle className="font-serif text-2xl">需要关注</CardTitle>
              <CardDescription>建议优先处理的状态</CardDescription>
              <CardAction>
                <Badge
                  variant={data.attention.length ? "destructive" : "secondary"}
                >
                  {data.attention.length}
                </Badge>
              </CardAction>
            </CardHeader>
            <CardContent>
              {data.attention.length === 0 ? (
                <Empty className="min-h-40">
                  <EmptyHeader>
                    <EmptyMedia variant="icon">
                      <CheckCircle2Icon aria-hidden="true" />
                    </EmptyMedia>
                    <EmptyTitle>无需处理</EmptyTitle>
                    <EmptyDescription>
                      当前没有需要人工关注的项目。
                    </EmptyDescription>
                  </EmptyHeader>
                </Empty>
              ) : (
                <VirtualList
                  items={data.attention}
                  estimateSize={72}
                  getKey={(item) => item.id}
                  renderItem={(item, index) => (
                    <div className="px-1">
                      <article className="flex items-start gap-3 py-3">
                        <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-destructive/10 text-destructive">
                          <AlertTriangleIcon
                            className="size-4"
                            aria-hidden="true"
                          />
                        </span>
                        <div className="flex min-w-0 flex-1 flex-col gap-1">
                          <h3 className="text-sm leading-snug font-medium">
                            {item.title}
                          </h3>
                          <p className="text-xs leading-relaxed text-muted-foreground">
                            {item.description}
                          </p>
                        </div>
                      </article>
                      {index < data.attention.length - 1 && <Separator />}
                    </div>
                  )}
                />
              )}
            </CardContent>
          </Card>
        </Reveal>
      </section>
    </main>
  )
}

function OverviewSkeleton() {
  return (
    <main className="mx-auto flex w-full max-w-7xl flex-col gap-4 px-3 py-4 md:px-6 md:py-5">
      <Skeleton className="h-20 w-2/3" />
      <Skeleton className="h-56 w-full rounded-2xl" />
      <div className="grid gap-3 md:grid-cols-4">
        {Array.from({ length: 4 }, (_, index) => (
          <Skeleton key={index} className="h-28" />
        ))}
      </div>
    </main>
  )
}
