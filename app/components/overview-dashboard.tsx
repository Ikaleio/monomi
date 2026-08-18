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

import {
  Reveal,
  staggerContainer,
  staggerItem,
} from "~/components/motion-primitives"
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
import { cn } from "~/lib/utils"
import { attentionItems, monitors, systemOverview } from "~/data/mock-data"

const stats = [
  {
    label: "24 小时检查成功率",
    value: `${systemOverview.successRate24h}%`,
    detail: `${systemOverview.totalChecks24h.toLocaleString("zh-CN")} 次检查`,
    icon: ActivityIcon,
  },
  {
    label: "启用监视器",
    value: systemOverview.enabledMonitors.toString(),
    detail: "全部在线",
    icon: ServerIcon,
  },
  {
    label: "当前故障",
    value: systemOverview.activeIncidents.toString(),
    detail: "无进行中事件",
    icon: CheckCircle2Icon,
  },
  {
    label: "30 天内到期证书",
    value: systemOverview.expiringCertificates.toString(),
    detail: "需要安排续签",
    icon: ShieldCheckIcon,
  },
]

export function OverviewDashboard() {
  return (
    <main className="mx-auto flex max-w-7xl flex-col gap-10 px-4 py-8 md:px-8 md:py-10">
      <motion.section
        initial="hidden"
        animate="visible"
        variants={staggerContainer}
        className="flex flex-col gap-7"
      >
        <motion.div
          variants={staggerItem}
          className="flex flex-col justify-between gap-5 md:flex-row md:items-end"
        >
          <div className="flex max-w-2xl flex-col gap-2">
            <p className="text-sm font-medium text-primary">运行总览</p>
            <h1 className="font-serif text-4xl font-semibold tracking-tight text-balance md:text-5xl">
              今天，一切稳定。
            </h1>
            <p className="text-sm leading-relaxed text-muted-foreground md:text-base">
              汇总当前启用的监视器，以及最近 24 小时内的服务表现。
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline">
              <RefreshCwIcon data-icon="inline-start" aria-hidden="true" />
              刷新
            </Button>
            <Button>
              <PlusIcon data-icon="inline-start" aria-hidden="true" />
              新建监视器
            </Button>
          </div>
        </motion.div>

        <motion.div
          variants={staggerItem}
          className="grid overflow-hidden rounded-3xl bg-primary text-primary-foreground shadow-[0_28px_80px_-44px_var(--primary)] lg:grid-cols-[1.3fr_1fr]"
        >
          <div className="flex flex-col justify-between gap-10 p-6 md:p-9">
            <div className="flex items-start justify-between gap-6">
              <div className="flex flex-col gap-2">
                <span className="text-sm text-primary-foreground/70">
                  全局服务状态
                </span>
                <h2 className="font-serif text-3xl font-semibold md:text-4xl">
                  运行正常
                </h2>
              </div>
              <motion.span
                className="flex size-12 items-center justify-center rounded-2xl bg-primary-foreground/15"
                animate={{ rotate: [0, 4, 0, -4, 0], scale: [1, 1.04, 1] }}
                transition={{
                  duration: 4.2,
                  repeat: Infinity,
                  ease: "easeInOut",
                }}
              >
                <ActivityIcon className="size-6" aria-hidden="true" />
              </motion.span>
            </div>
            <div className="flex items-end gap-3">
              <span className="font-serif text-6xl font-semibold tracking-tight tabular-nums md:text-7xl">
                99.99
              </span>
              <span className="pb-2 text-lg text-primary-foreground/75">%</span>
            </div>
            <p className="text-sm text-primary-foreground/70">
              最近 24 小时整体检查成功率
            </p>
          </div>
          <div className="grid grid-cols-2 border-t border-primary-foreground/15 lg:border-t-0 lg:border-l">
            {[
              ["启用监视器", systemOverview.enabledMonitors, "个"],
              ["当前故障", systemOverview.activeIncidents, "个"],
              ["检查总数", "12.1", "万"],
              ["最后更新", "16:42", ""],
            ].map(([label, value, suffix], index) => (
              <motion.div
                key={label}
                className={cn(
                  "flex min-h-32 flex-col justify-between border-primary-foreground/15 p-5 odd:border-r md:p-6",
                  index < 2 && "border-b"
                )}
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

      <section aria-labelledby="stats-title" className="flex flex-col gap-5">
        <Reveal>
          <h2 id="stats-title" className="font-serif text-2xl font-semibold">
            核心统计
          </h2>
        </Reveal>
        <motion.div
          className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4"
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, amount: 0.2 }}
          variants={staggerContainer}
        >
          {stats.map((stat) => {
            const Icon = stat.icon
            return (
              <motion.div
                key={stat.label}
                variants={staggerItem}
                whileHover={{ y: -5 }}
              >
                <Card className="h-full">
                  <CardHeader>
                    <CardDescription>{stat.label}</CardDescription>
                    <CardAction>
                      <span className="flex size-9 items-center justify-center rounded-xl bg-muted text-muted-foreground">
                        <Icon className="size-4" aria-hidden="true" />
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
            )
          })}
        </motion.div>
      </section>

      <section
        aria-labelledby="monitor-summary-title"
        className="grid gap-6 xl:grid-cols-[1.35fr_1fr]"
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
              <CardDescription>当前启用项目的即时状态</CardDescription>
              <CardAction>
                <Button variant="ghost" size="sm">
                  查看全部
                  <ArrowUpRightIcon data-icon="inline-end" aria-hidden="true" />
                </Button>
              </CardAction>
            </CardHeader>
            <CardContent className="flex flex-col">
              {monitors.map((monitor, index) => (
                <div key={monitor.id}>
                  <motion.div
                    className="flex items-center justify-between gap-4 py-4"
                    initial={{ opacity: 0, x: -12 }}
                    whileInView={{ opacity: 1, x: 0 }}
                    viewport={{ once: true }}
                    transition={{ delay: index * 0.08 }}
                  >
                    <div className="flex min-w-0 items-center gap-3">
                      <span
                        className="size-2 shrink-0 rounded-full bg-primary"
                        aria-hidden="true"
                      />
                      <div className="flex min-w-0 flex-col gap-1">
                        <span className="truncate font-medium">
                          {monitor.name}
                        </span>
                        <span className="truncate text-xs text-muted-foreground">
                          {monitor.description}
                        </span>
                      </div>
                    </div>
                    <div className="flex shrink-0 items-center gap-4">
                      <span className="hidden text-sm font-medium tabular-nums sm:inline">
                        {monitor.uptime.day.toFixed(2)}%
                      </span>
                      <Badge variant="success">正常</Badge>
                    </div>
                  </motion.div>
                  {index < monitors.length - 1 && <Separator />}
                </div>
              ))}
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
                  variant={attentionItems.length ? "destructive" : "secondary"}
                >
                  {attentionItems.length}
                </Badge>
              </CardAction>
            </CardHeader>
            <CardContent>
              {attentionItems.length === 0 ? (
                <Empty className="min-h-56">
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
                <div className="flex flex-col">
                  {attentionItems.map((item, index) => (
                    <div key={item.id}>
                      <motion.article
                        className="flex items-start gap-3 py-4"
                        initial={{ opacity: 0, x: 16 }}
                        whileInView={{ opacity: 1, x: 0 }}
                        viewport={{ once: true }}
                        transition={{ delay: 0.08 + index * 0.1 }}
                      >
                        <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-destructive/10 text-destructive">
                          {item.severity === "high" ? (
                            <AlertTriangleIcon
                              className="size-4"
                              aria-hidden="true"
                            />
                          ) : (
                            <Clock3Icon className="size-4" aria-hidden="true" />
                          )}
                        </span>
                        <div className="flex min-w-0 flex-1 flex-col gap-1">
                          <h3 className="text-sm leading-snug font-medium">
                            {item.title}
                          </h3>
                          <p className="text-xs leading-relaxed text-muted-foreground">
                            {item.description}
                          </p>
                          <span className="text-xs text-muted-foreground/70">
                            {item.time}
                          </span>
                        </div>
                      </motion.article>
                      {index < attentionItems.length - 1 && <Separator />}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </Reveal>
      </section>
    </main>
  )
}
