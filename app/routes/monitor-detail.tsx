import { Line, LineChart, CartesianGrid, XAxis } from "recharts"
import { useState } from "react"
import { Link, useNavigate, useParams } from "react-router"
import { toast } from "sonner"
import { mutate } from "swr"

import { StatusHistory } from "~/components/status-history"
import { VirtualList } from "~/components/virtual-list"
import { Alert, AlertDescription, AlertTitle } from "~/components/ui/alert"
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "~/components/ui/alert-dialog"
import { Badge } from "~/components/ui/badge"
import { Button } from "~/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "~/components/ui/card"
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "~/components/ui/chart"
import { Skeleton } from "~/components/ui/skeleton"
import { Table, TableHead, TableHeader, TableRow } from "~/components/ui/table"
import { useMonitor, useMonitorActivity } from "~/hooks/use-monitors"
import { api, fetchJson } from "~/lib/api-client"
import { editableMonitor } from "~/lib/monitor-input"

const statusText = { operational: "运行正常", degraded: "性能下降", outage: "服务中断", pending: "等待检查", paused: "计划维护" } as const

export function meta() { return [{ title: "监视器详情 · Monomi" }] }

export default function MonitorDetailRoute() {
  const { monitorId } = useParams()
  const navigate = useNavigate()
  const monitorQuery = useMonitor(monitorId)
  const activityQuery = useMonitorActivity(monitorId)
  const [heartbeatUrl, setHeartbeatUrl] = useState<string | null>(null)
  const [pending, setPending] = useState(false)
  if (!monitorQuery.data && !monitorQuery.error) return <main className="mx-auto max-w-7xl p-6"><Skeleton className="h-96 w-full" /></main>
  if (monitorQuery.error || !monitorQuery.data || !monitorId) return <main className="mx-auto max-w-7xl p-6"><Alert variant="destructive"><AlertTitle>无法加载监视器</AlertTitle><AlertDescription>{monitorQuery.error instanceof Error ? monitorQuery.error.message : "监视器不存在"}</AlertDescription></Alert></main>
  const monitor = monitorQuery.data.monitor
  const id = monitorId

  async function refreshAll() { await Promise.all([monitorQuery.mutate(), activityQuery.mutate(), mutate("monitors"), mutate("overview")]) }
  async function runNow() { setPending(true); try { await fetchJson(api.admin.monitors[":id"].run.$url({ param: { id } }).toString(), { method: "POST" }); toast.success("检测已完成"); await refreshAll() } finally { setPending(false) } }
  async function toggleEnabled() { setPending(true); try { const input = editableMonitor(monitor); input.enabled = !monitor.enabled; await fetchJson(api.admin.monitors[":id"].$url({ param: { id } }).toString(), { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(input) }); toast.success(input.enabled ? "监视器已恢复" : "监视器已暂停"); await refreshAll() } finally { setPending(false) } }
  async function regenerateHeartbeat() { const result = await fetchJson<{ heartbeatPath: string }>(api.admin.monitors[":id"]["heartbeat-token"].$url({ param: { id } }).toString(), { method: "POST" }); setHeartbeatUrl(`${window.location.origin}${result.heartbeatPath}`); toast.success("Heartbeat 地址已重新生成") }
  async function remove() { await fetchJson(api.admin.monitors[":id"].$url({ param: { id } }).toString(), { method: "DELETE" }); await mutate("monitors"); navigate("/app/monitors"); toast.success("监视器已删除") }

  const checks = activityQuery.data?.checks.checks ?? []
  const buckets = activityQuery.data?.metrics.buckets ?? []
  const history = activityQuery.data?.history.history ?? []
  return <main className="mx-auto flex max-w-7xl flex-col gap-8 px-4 py-8 md:px-8 md:py-10"><div className="flex flex-col justify-between gap-5 md:flex-row md:items-end"><div className="flex flex-col gap-2"><p className="text-sm font-medium text-primary">{monitor.type.toUpperCase()}</p><div className="flex flex-wrap items-center gap-3"><h1 className="font-serif text-4xl font-semibold">{monitor.name}</h1><Badge variant={monitor.status === "operational" ? "success" : monitor.status === "outage" || monitor.status === "degraded" ? "destructive" : "outline"}>{statusText[monitor.status]}</Badge></div><p className="text-muted-foreground">{monitor.description || "无描述"}</p></div><div className="flex flex-wrap gap-2">{monitor.type !== "heartbeat" && <Button variant="outline" disabled={pending} onClick={() => void runNow()}>立即检测</Button>}<Button variant="outline" disabled={pending} onClick={() => void toggleEnabled()}>{monitor.enabled ? "暂停" : "恢复"}</Button><Button asChild><Link to={`/app/monitors/${monitor.id}/edit`}>编辑</Link></Button><AlertDialog><AlertDialogTrigger asChild><Button variant="destructive">删除</Button></AlertDialogTrigger><AlertDialogContent><AlertDialogHeader><AlertDialogTitle>删除监视器？</AlertDialogTitle><AlertDialogDescription>该操作会删除相关检查、故障和通知历史，无法撤销。</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>取消</AlertDialogCancel><AlertDialogAction onClick={() => void remove()}>确认删除</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog></div></div>
  {monitor.type === "heartbeat" && <Card><CardHeader><CardTitle>Heartbeat</CardTitle><CardDescription>地址只在创建或重新生成时显示一次。</CardDescription></CardHeader><CardContent className="flex flex-col gap-4">{heartbeatUrl && <Alert><AlertTitle>新的 Heartbeat 地址</AlertTitle><AlertDescription><code className="block overflow-x-auto rounded-lg bg-muted p-3">{heartbeatUrl}</code></AlertDescription></Alert>}<Button variant="outline" onClick={() => void regenerateHeartbeat()}>重新生成地址</Button></CardContent></Card>}
  <div className="grid gap-6 xl:grid-cols-2"><Card><CardHeader><CardTitle className="font-serif text-2xl">24 小时延迟</CardTitle><CardDescription>每五分钟聚合成功检查</CardDescription></CardHeader><CardContent>{buckets.length ? <ChartContainer className="h-72 w-full" config={{ latencyMs: { label: "延迟", color: "var(--chart-1)" } }}><LineChart data={buckets}><CartesianGrid vertical={false} /><XAxis dataKey="time" tickFormatter={(value)=>new Date(value).toLocaleTimeString("zh-CN",{hour:"2-digit",minute:"2-digit"})} /><ChartTooltip content={<ChartTooltipContent />} /><Line type="monotone" dataKey="latencyMs" stroke="var(--color-latencyMs)" dot={false} /></LineChart></ChartContainer> : <p className="py-20 text-center text-muted-foreground">暂无延迟数据</p>}</CardContent></Card><Card><CardHeader><CardTitle className="font-serif text-2xl">90 天历史</CardTitle><CardDescription>每日可用性状态</CardDescription></CardHeader><CardContent>{history.length ? <StatusHistory history={history} label={monitor.name} /> : <p className="py-20 text-center text-muted-foreground">暂无历史</p>}</CardContent></Card></div>
  <Card><CardHeader><CardTitle className="font-serif text-2xl">最近检查</CardTitle><CardDescription>最多显示最近 50 条，列表使用虚拟滚动。</CardDescription></CardHeader><CardContent><Table><TableHeader><TableRow><TableHead>时间</TableHead><TableHead>结果</TableHead><TableHead>延迟</TableHead><TableHead>详情</TableHead></TableRow></TableHeader></Table>{checks.length ? <VirtualList items={checks} estimateSize={52} height={420} getKey={(check)=>check.id} renderItem={(check)=><div className="grid h-full grid-cols-4 items-center border-b px-2 text-sm"><span>{new Date(check.checkedAt).toLocaleString("zh-CN")}</span><Badge variant={check.success ? "success" : "destructive"}>{check.success ? "成功" : "失败"}</Badge><span>{check.latencyMs} ms</span><span className="truncate text-muted-foreground">{check.errorMessage ?? check.statusCode ?? "—"}</span></div>} /> : <p className="py-12 text-center text-muted-foreground">暂无检查记录</p>}</CardContent></Card></main>
}
