import { Link } from "react-router"
import { useTranslation } from "react-i18next"

import { VirtualList } from "~/components/virtual-list"
import { Alert, AlertDescription, AlertTitle } from "~/components/ui/alert"
import { Badge } from "~/components/ui/badge"
import { Button } from "~/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "~/components/ui/card"
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "~/components/ui/empty"
import { Skeleton } from "~/components/ui/skeleton"
import { useMonitors } from "~/hooks/use-monitors"

const statusText = { operational: "运行正常", degraded: "性能下降", outage: "服务中断", pending: "等待检查", paused: "计划维护" } as const

export function meta() { return [{ title: "监视器 · Monomi" }] }

export default function MonitorsRoute() {
  const { t } = useTranslation()
  const { data, error, isLoading } = useMonitors()
  if (isLoading) return <main className="mx-auto max-w-7xl p-6"><Skeleton className="h-64 w-full" /></main>
  if (error || !data) return <main className="mx-auto max-w-7xl p-6"><Alert variant="destructive"><AlertTitle>无法加载监视器</AlertTitle><AlertDescription>{error instanceof Error ? error.message : "请稍后重试。"}</AlertDescription></Alert></main>
  return <main className="mx-auto flex max-w-7xl flex-col gap-6 px-4 py-8 md:px-8 md:py-10"><div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end"><div className="flex flex-col gap-2"><p className="text-sm font-medium text-primary">运行中心</p><h1 className="font-serif text-4xl font-semibold">监视器</h1><p className="text-muted-foreground">管理 HTTP、TCP 和 Heartbeat 检测目标。</p></div><Button asChild><Link to="/app/monitors/new">新建监视器</Link></Button></div><Card><CardHeader><CardTitle className="font-serif text-2xl">全部监视器</CardTitle><CardDescription>{data.monitors.length} 个配置</CardDescription></CardHeader><CardContent>{data.monitors.length === 0 ? <Empty className="min-h-64"><EmptyHeader><EmptyMedia variant="icon">＋</EmptyMedia><EmptyTitle>还没有监视器</EmptyTitle><EmptyDescription>创建第一个监视器开始检测。</EmptyDescription><Button asChild><Link to="/app/monitors/new">新建监视器</Link></Button></EmptyHeader></Empty> : <VirtualList items={data.monitors} estimateSize={76} getKey={(monitor)=>monitor.id} renderItem={(monitor)=><Link to={`/app/monitors/${monitor.id}`} className="flex items-center justify-between gap-4 rounded-xl px-3 py-4 outline-none hover:bg-muted/50 focus-visible:ring-2 focus-visible:ring-ring"><div className="flex min-w-0 items-center gap-3"><span className={`size-2 shrink-0 rounded-full ${monitor.status === "operational" ? "bg-primary" : monitor.status === "paused" ? "bg-foreground/30" : "bg-destructive"}`} aria-hidden="true" /><div className="flex min-w-0 flex-col gap-1"><span className="truncate font-medium">{monitor.name}</span><span className="truncate text-xs text-muted-foreground">{monitor.type.toUpperCase()} · {monitor.description || "无描述"}</span></div></div><Badge variant={monitor.status === "operational" ? "success" : monitor.status === "outage" || monitor.status === "degraded" ? "destructive" : "outline"}>{statusText[monitor.status]}</Badge></Link>} />}</CardContent></Card></main>
}
