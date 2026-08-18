import { CheckCircle2Icon } from "lucide-react"
import { useState } from "react"
import { useNavigate } from "react-router"
import { toast } from "sonner"

import { MonitorForm } from "~/components/monitor-form"
import { Alert, AlertDescription, AlertTitle } from "~/components/ui/alert"
import { Button } from "~/components/ui/button"
import { api, fetchJson } from "~/lib/api-client"
import type { MonitorInput } from "../../shared/contracts"

export function meta() { return [{ title: "新建监视器 · Monomi" }] }

export default function MonitorNewRoute() {
  const navigate = useNavigate()
  const [pending, setPending] = useState(false)
  const [heartbeatPath, setHeartbeatPath] = useState<string | null>(null)

  async function submit(input: MonitorInput) {
    setPending(true)
    try {
      const result = await fetchJson<{ monitor: { id: string }; heartbeatPath?: string }>(api.admin.monitors.$url().toString(), { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(input) })
      if (result.heartbeatPath) setHeartbeatPath(`${window.location.origin}${result.heartbeatPath}`)
      else navigate(`/app/monitors/${result.monitor.id}`)
      toast.success("监视器已创建")
    } finally { setPending(false) }
  }

  return <main className="mx-auto flex max-w-5xl flex-col gap-8 px-4 py-8 md:px-8 md:py-10"><div className="flex flex-col gap-2"><p className="text-sm font-medium text-primary">监视器</p><h1 className="font-serif text-4xl font-semibold">新建监视器</h1><p className="text-muted-foreground">选择检测类型并设置明确的成功条件。</p></div>{heartbeatPath && <Alert><CheckCircle2Icon aria-hidden="true" /><AlertTitle>Heartbeat 地址已生成</AlertTitle><AlertDescription className="flex flex-col gap-3"><code className="overflow-x-auto rounded-lg bg-muted p-3 text-sm">{heartbeatPath}</code><Button variant="outline" size="sm" onClick={() => { void navigator.clipboard.writeText(heartbeatPath); toast.success("地址已复制") }}>复制地址</Button><Button variant="ghost" size="sm" onClick={() => navigate("/app/monitors")}>返回监视器</Button></AlertDescription></Alert>}<MonitorForm pending={pending} submitLabel="创建监视器" onSubmit={submit} /></main>
}
