import { ArrowDownIcon, ArrowUpIcon, ExternalLinkIcon, UploadIcon } from "lucide-react"
import { useState } from "react"
import { Link } from "react-router"
import { toast } from "sonner"
import { mutate } from "swr"

import { Alert, AlertDescription, AlertTitle } from "~/components/ui/alert"
import { Button } from "~/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "~/components/ui/card"
import { Checkbox } from "~/components/ui/checkbox"
import { Field, FieldDescription, FieldGroup, FieldLabel } from "~/components/ui/field"
import { Switch } from "~/components/ui/switch"
import { Skeleton } from "~/components/ui/skeleton"
import { useStatusPageSettings } from "~/hooks/use-settings"
import { api, fetchJson } from "~/lib/api-client"

export function meta() { return [{ title: "状态页设置 · Monomi" }] }

export default function StatusPageSettingsRoute() {
  const { data, error, isLoading } = useStatusPageSettings()
  const [pending, setPending] = useState(false)
  const [publicEnabled, setPublicEnabled] = useState<boolean | null>(null)
  const [showResponseTime, setShowResponseTime] = useState<boolean | null>(null)
  const [order, setOrder] = useState<string[] | null>(null)
  if (isLoading) return <main className="mx-auto max-w-5xl p-6"><Skeleton className="h-96 w-full" /></main>
  if (error || !data) return <main className="mx-auto max-w-5xl p-6"><Alert variant="destructive"><AlertTitle>无法加载状态页设置</AlertTitle><AlertDescription>{error instanceof Error ? error.message : "请稍后重试。"}</AlertDescription></Alert></main>
  const selected = order ?? data.monitors.filter((monitor)=>monitor.selected).sort((a,b)=>(a.sortOrder ?? 0)-(b.sortOrder ?? 0)).map((monitor)=>monitor.id)
  const enabled = publicEnabled ?? data.publicEnabled
  const responseTime = showResponseTime ?? data.publicShowResponseTime
  async function save() { setPending(true); try { await fetchJson(api.admin["status-page"].$url().toString(), { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ publicEnabled: enabled, publicShowResponseTime: responseTime, monitorIds: selected }) }); toast.success("状态页设置已保存"); await mutate("status-page-settings") } finally { setPending(false) } }
  async function upload(event: React.ChangeEvent<HTMLInputElement>) { const file = event.target.files?.[0]; if (!file) return; const body = new FormData(); body.append("file", file); await fetchJson(api.admin["status-page"].logo.$url().toString(), { method: "POST", body }); toast.success("Logo 已上传"); await mutate("status-page-settings") }
  async function removeLogo() { await fetchJson(api.admin["status-page"].logo.$url().toString(), { method: "DELETE" }); toast.success("Logo 已移除"); await mutate("status-page-settings") }
  function move(id: string, direction: -1 | 1) { const next=[...selected]; const index=next.indexOf(id); const target=index+direction; if(index<0||target<0||target>=next.length)return; [next[index],next[target]]=[next[target],next[index]]; setOrder(next) }
  return <main className="mx-auto flex max-w-5xl flex-col gap-8 px-4 py-8 md:px-8 md:py-10"><div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end"><div className="flex flex-col gap-2"><p className="text-sm font-medium text-primary">{`Monomi`}</p><h1 className="font-serif text-4xl font-semibold">状态页设置</h1><p className="text-muted-foreground">选择公开内容、响应时间和监视器顺序。</p></div><Button variant="outline" asChild><Link to="/" target="_blank">打开公开页 <ExternalLinkIcon data-icon="inline-end" /></Link></Button></div><Card><CardHeader><CardTitle className="font-serif text-2xl">公开显示</CardTitle><CardDescription>公开 API 会过滤目标、Header、Body 和原始错误。</CardDescription></CardHeader><CardContent><FieldGroup><Field orientation="horizontal"><Switch checked={enabled} onCheckedChange={setPublicEnabled} /><FieldLabel>启用公开状态页</FieldLabel></Field><Field orientation="horizontal"><Switch checked={responseTime} onCheckedChange={setShowResponseTime} /><FieldLabel>显示响应时间</FieldLabel></Field></FieldGroup></CardContent></Card><Card><CardHeader><CardTitle className="font-serif text-2xl">公开监视器</CardTitle><CardDescription>未选中的监视器不会出现在 /。</CardDescription></CardHeader><CardContent><div className="flex flex-col gap-3">{data.monitors.map((monitor)=><div className="flex items-center justify-between gap-3 rounded-xl border p-3" key={monitor.id}><label className="flex min-w-0 items-center gap-3"><Checkbox checked={selected.includes(monitor.id)} onCheckedChange={(checked)=>setOrder(checked?[...selected,monitor.id]:selected.filter((id)=>id!==monitor.id))} /><span className="truncate">{monitor.name}</span></label>{selected.includes(monitor.id)&&<div className="flex items-center gap-1"><Button size="icon-sm" variant="ghost" aria-label="上移" onClick={()=>move(monitor.id,-1)}><ArrowUpIcon aria-hidden="true" /></Button><Button size="icon-sm" variant="ghost" aria-label="下移" onClick={()=>move(monitor.id,1)}><ArrowDownIcon aria-hidden="true" /></Button></div>}</div>)}</div></CardContent></Card><Card><CardHeader><CardTitle className="font-serif text-2xl">Logo</CardTitle><CardDescription>只接受不超过 2 MiB 的 PNG、JPEG 或 WebP。</CardDescription></CardHeader><CardContent className="flex flex-col gap-4"><Field><FieldLabel htmlFor="logo">上传 Logo</FieldLabel><input id="logo" type="file" accept="image/png,image/jpeg,image/webp" onChange={(event)=>void upload(event)} /><FieldDescription>服务端会同时检查 MIME 和文件签名。</FieldDescription></Field>{data.logoPath&&<Button variant="outline" onClick={()=>void removeLogo()}>移除 Logo</Button>}</CardContent></Card><Button disabled={pending} onClick={()=>void save()}>{pending ? "正在保存" : "保存状态页设置"}</Button></main>
}
