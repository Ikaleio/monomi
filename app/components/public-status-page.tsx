import { motion } from "framer-motion"
import { ArrowUpRightIcon, CheckIcon, Clock3Icon } from "lucide-react"
import { Link } from "react-router"

import { BrandMark } from "~/components/brand-mark"
import { MonitorCard } from "~/components/monitor-card"
import {
  Reveal,
  staggerContainer,
  staggerItem,
} from "~/components/motion-primitives"
import { UtilityMenus } from "~/components/utility-menus"
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
import { incidents, monitors, systemOverview } from "~/data/mock-data"

export function PublicStatusPage() {
  return (
    <main className="min-h-svh overflow-hidden bg-background">
      <header className="sticky top-0 z-40 border-b border-border/70 bg-background/85 backdrop-blur-xl">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-5 py-4 md:px-8">
          <BrandMark />
          <div className="flex items-center gap-2">
            <UtilityMenus />
            <Button
              variant="outline"
              size="sm"
              asChild
              className="hidden sm:inline-flex"
            >
              <Link to="/overview">
                运行总览
                <ArrowUpRightIcon data-icon="inline-end" aria-hidden="true" />
              </Link>
            </Button>
          </div>
        </div>
      </header>

      <div className="mx-auto flex max-w-6xl flex-col gap-20 px-5 py-12 md:gap-28 md:px-8 md:py-20">
        <motion.section
          className="flex flex-col gap-10"
          initial="hidden"
          animate="visible"
          variants={staggerContainer}
        >
          <motion.div
            variants={staggerItem}
            className="flex max-w-3xl flex-col gap-5"
          >
            <Badge variant="success">
              <span
                className="size-1.5 rounded-full bg-primary"
                aria-hidden="true"
              />
              所有系统运行正常
            </Badge>
            <h1 className="font-serif text-4xl leading-tight font-semibold tracking-tight text-balance md:text-6xl md:leading-tight">
              Monomi 核心服务
              <br />
              一切运行如常。
            </h1>
            <p className="max-w-2xl text-base leading-relaxed text-pretty text-muted-foreground md:text-lg">
              我们持续关注每一次请求。这里公开展示服务可用性、维护进度与历史事件。
            </p>
          </motion.div>

          <motion.div
            variants={staggerItem}
            className="flex flex-col justify-between gap-6 rounded-3xl bg-primary p-6 text-primary-foreground shadow-[0_30px_90px_-45px_var(--primary)] md:flex-row md:items-center md:p-9"
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
                <CheckIcon className="size-6" aria-hidden="true" />
              </motion.span>
              <div className="flex flex-col gap-1">
                <p className="font-serif text-2xl font-semibold">
                  全局服务稳定
                </p>
                <p className="text-sm text-primary-foreground/75">
                  {monitors.length} 个监控项目均在正常响应
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 text-sm text-primary-foreground/75">
              <Clock3Icon className="size-4" aria-hidden="true" />
              更新于 {systemOverview.updatedAt}
            </div>
          </motion.div>
        </motion.section>

        <section
          aria-labelledby="monitors-title"
          className="flex flex-col gap-8"
        >
          <Reveal>
            <div className="flex flex-col gap-2">
              <p className="text-sm font-medium text-primary">实时可用性</p>
              <h2
                id="monitors-title"
                className="font-serif text-3xl font-semibold tracking-tight md:text-4xl"
              >
                每一项服务，清晰可见
              </h2>
            </div>
          </Reveal>
          <div className="flex flex-col gap-5">
            {monitors.map((monitor, index) => (
              <MonitorCard key={monitor.id} monitor={monitor} index={index} />
            ))}
          </div>
        </section>

        <section
          aria-labelledby="incidents-title"
          className="flex flex-col gap-8"
        >
          <Reveal>
            <div className="flex items-end justify-between gap-4">
              <div className="flex flex-col gap-2">
                <p className="text-sm font-medium text-primary">最近 90 天</p>
                <h2
                  id="incidents-title"
                  className="font-serif text-3xl font-semibold tracking-tight md:text-4xl"
                >
                  事件记录
                </h2>
              </div>
              <span className="text-sm text-muted-foreground">
                {incidents.length} 条记录
              </span>
            </div>
          </Reveal>

          {incidents.length === 0 ? (
            <Empty className="min-h-64 border bg-card">
              <EmptyHeader>
                <EmptyMedia variant="icon">
                  <CheckIcon aria-hidden="true" />
                </EmptyMedia>
                <EmptyTitle>近期无事件</EmptyTitle>
                <EmptyDescription>
                  过去 90 天内没有故障或维护记录。
                </EmptyDescription>
              </EmptyHeader>
            </Empty>
          ) : (
            <div className="flex flex-col">
              {incidents.map((incident, index) => (
                <Reveal key={incident.id} delay={index * 0.08}>
                  <article className="grid gap-4 py-7 md:grid-cols-[12rem_1fr_auto] md:items-start">
                    <time className="text-sm leading-relaxed text-muted-foreground">
                      {incident.time}
                    </time>
                    <div className="flex flex-col gap-2">
                      <h3 className="font-serif text-xl font-semibold">
                        {incident.title}
                      </h3>
                      <p className="max-w-2xl text-sm leading-relaxed text-muted-foreground">
                        {incident.summary}
                      </p>
                    </div>
                    <Badge
                      variant={
                        incident.status === "resolved" ? "secondary" : "outline"
                      }
                    >
                      {incident.status === "resolved" ? "已解决" : "维护完成"}
                    </Badge>
                  </article>
                  {index < incidents.length - 1 && <Separator />}
                </Reveal>
              ))}
            </div>
          )}
        </section>
      </div>

      <footer className="border-t border-border/70">
        <div className="mx-auto flex max-w-6xl flex-col justify-between gap-3 px-5 py-8 text-sm text-muted-foreground sm:flex-row sm:items-center md:px-8">
          <span>© 2026 Monomi Status</span>
          <span>透明、稳定、值得信赖</span>
        </div>
      </footer>
    </main>
  )
}
