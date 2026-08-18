import { useState } from "react"
import { toast } from "sonner"
import { mutate } from "swr"

import { VirtualList } from "~/components/virtual-list"
import { Alert, AlertDescription, AlertTitle } from "~/components/ui/alert"
import { Badge } from "~/components/ui/badge"
import { Button } from "~/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "~/components/ui/card"
import { Checkbox } from "~/components/ui/checkbox"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "~/components/ui/dialog"
import { Field, FieldGroup, FieldLabel } from "~/components/ui/field"
import { Input } from "~/components/ui/input"
import { Skeleton } from "~/components/ui/skeleton"
import { Textarea } from "~/components/ui/textarea"
import { useMonitors } from "~/hooks/use-monitors"
import { useNotifications } from "~/hooks/use-notifications"
import { api, fetchJson } from "~/lib/api-client"

const defaultTemplate = '{"event":"{{event}}","monitor":"{{monitor.name}}","status":"{{monitor.status}}"}'

type Draft = { name: string; url: string; bodyTemplate: string; enabled: boolean; allMonitors: boolean; monitorIds: string[] }
const emptyDraft: Draft = { name: "", url: "", bodyTemplate: defaultTemplate, enabled: true, allMonitors: true, monitorIds: [] }

export function meta() { return [{ title: "通知 · Monomi" }] }

export default function NotificationsRoute() {
  const { data, error, isLoading } = useNotifications()
  const monitorsQuery = useMonitors()
  const [open, setOpen] = useState(false)
  const [draft, setDraft] = useState(emptyDraft)
  const [saving, setSaving] = useState(false)
  if (isLoading) return <main className="mx-auto max-w-7xl p-6"><Skeleton className="h-96 w-full" /></main>
  if (error || !data) return <main className="mx-auto max-w-7xl p-6"><Alert variant="destructive"><AlertTitle>无法加载通知</AlertTitle><AlertDescription>{error instanceof Error ? error.message : "请稍后重试。"}</AlertDescription></Alert></main>
  async function createChannel() { setSaving(true); try { await fetchJson(api.admin.notifications.$url().toString(), { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: draft.name, url: draft.url, bodyTemplate: draft.bodyTemplate, enabled: draft.enabled, headers: {}, monitorIds: draft.allMonitors ? null : draft.monitorIds }) }); toast.success("通知渠道已创建"); setOpen(false); setDraft(emptyDraft); await mutate("notifications") } finally { setSaving(false) } }
  async function testChannel(id: string) { const result = await fetchJson<{ delivery: { status: string } }>(api.admin.notifications[":id"].test.$url({ param: { id } }).toString(), { method: "POST" }); toast.success(result.delivery.status === "sent" ? "测试通知已发送" : "通知已进入重试队列"); await mutate("notifications") }
  async function removeChannel(id: string) { await fetchJson(api.admin.notifications[":id"].$url({ param: { id } }).toString(), { method: "DELETE" }); toast.success("通知渠道已删除"); await mutate("notifications") }
  return <main className="mx-auto flex max-w-7xl flex-col gap-6 px-4 py-8 md:px-8 md:py-10"><div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end"><div className="flex flex-col gap-2"><p className="text-sm font-medium text-primary">运行中心</p><h1 className="font-serif text-4xl font-semibold">通知</h1><p className="text-muted-foreground">只发送通用 Webhook，故障、恢复和证书事件会持久化重试。</p></div><Dialog open={open} onOpenChange={setOpen}><DialogTrigger asChild><Button>添加 Webhook</Button></DialogTrigger><DialogContent><DialogHeader><DialogTitle>添加 Webhook 渠道</DialogTitle><DialogDescription>保存前会验证模板并发送 JSON 请求。</DialogDescription></DialogHeader><FieldGroup><Field><FieldLabel htmlFor="channel-name">名称</FieldLabel><Input id="channel-name" value={draft.name} onChange={(event)=>setDraft({...draft,name:event.target.value})} /></Field><Field><FieldLabel htmlFor="channel-url">URL</FieldLabel><Input id="channel-url" type="url" value={draft.url} onChange={(event)=>setDraft({...draft,url:event.target.value})} /></Field><Field><FieldLabel htmlFor="channel-template">Body template</FieldLabel><Textarea id="channel-template" value={draft.bodyTemplate} onChange={(event)=>setDraft({...draft,bodyTemplate:event.target.value})} /></Field><Field orientation="horizontal"><Checkbox id="all-monitors" checked={draft.allMonitors} onCheckedChange={(checked)=>setDraft({...draft,allMonitors:Boolean(checked)})} /><FieldLabel htmlFor="all-monitors">应用到全部监视器</FieldLabel></Field>{!draft.allMonitors && <Field><FieldLabel>选择监视器</FieldLabel><div className="flex max-h-40 flex-col gap-2 overflow-auto">{(monitorsQuery.data?.monitors ?? []).map((monitor)=><label className="flex items-center gap-2 text-sm" key={monitor.id}><Checkbox checked={draft.monitorIds.includes(monitor.id)} onCheckedChange={(checked)=>setDraft({...draft,monitorIds:checked?[...draft.monitorIds,monitor.id]:draft.monitorIds.filter((id)=>id!==monitor.id)})} />{monitor.name}</label>)}</div></Field>}</FieldGroup><DialogFooter><Button variant="outline" onClick={()=>setOpen(false)}>取消</Button><Button disabled={saving} onClick={()=>void createChannel()}>{saving ? "正在保存" : "保存"}</Button></DialogFooter></DialogContent></Dialog></div><Card><CardHeader><CardTitle className="font-serif text-2xl">Webhook 渠道</CardTitle><CardDescription>{data.channels.length} 个渠道</CardDescription></CardHeader><CardContent>{data.channels.length === 0 ? <p className="py-12 text-center text-muted-foreground">还没有通知渠道。</p> : <div className="flex flex-col gap-3">{data.channels.map((channel)=><div className="flex flex-col justify-between gap-3 rounded-xl border p-4 sm:flex-row sm:items-center" key={channel.id}><div className="flex min-w-0 flex-col gap-1"><span className="font-medium">{channel.name}</span><span className="truncate text-sm text-muted-foreground">{channel.url}</span></div><div className="flex items-center gap-2"><Badge variant={channel.enabled ? "success" : "outline"}>{channel.enabled ? "启用" : "停用"}</Badge><Button size="sm" variant="outline" onClick={()=>void testChannel(channel.id)}>测试</Button><Button size="sm" variant="ghost" onClick={()=>void removeChannel(channel.id)}>删除</Button></div></div>)}</div>}</CardContent></Card><Card><CardHeader><CardTitle className="font-serif text-2xl">发送记录</CardTitle><CardDescription>最近 50 条，使用虚拟滚动。</CardDescription></CardHeader><CardContent>{data.deliveries.length ? <VirtualList items={data.deliveries} estimateSize={60} getKey={(delivery)=>delivery.id} renderItem={(delivery)=><div className="grid h-full grid-cols-3 items-center border-b px-2 text-sm"><span>{delivery.eventType}</span><Badge variant={delivery.status === "sent" ? "success" : delivery.status === "failed" ? "destructive" : "outline"}>{delivery.status}</Badge><span className="truncate text-muted-foreground">{delivery.lastError ?? `${delivery.attempts} 次尝试`}</span></div>} /> : <p className="py-12 text-center text-muted-foreground">暂无发送记录。</p>}</CardContent></Card></main>
}
