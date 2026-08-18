import { useState } from "react"
import { useNavigate, useParams } from "react-router"
import { toast } from "sonner"

import type { MonitorInput } from "../../shared/contracts"
import { MonitorForm } from "~/components/monitor-form"
import { Alert, AlertDescription, AlertTitle } from "~/components/ui/alert"
import { Skeleton } from "~/components/ui/skeleton"
import { useMonitor } from "~/hooks/use-monitors"
import { api, fetchJson } from "~/lib/api-client"
import { editableMonitor } from "~/lib/monitor-input"

export function meta() {
  return [{ title: "编辑监视器 · Monomi" }]
}

export default function MonitorEditRoute() {
  const { monitorId } = useParams()
  const navigate = useNavigate()
  const { data, error } = useMonitor(monitorId)
  const [pending, setPending] = useState(false)
  if (!data && !error)
    return (
      <main className="w-full px-3 py-6 md:px-8">
        <Skeleton className="h-96 w-full" />
      </main>
    )
  if (error || !data)
    return (
      <main className="w-full px-3 py-6 md:px-8">
        <Alert variant="destructive">
          <AlertTitle>无法加载监视器</AlertTitle>
          <AlertDescription>
            {error instanceof Error ? error.message : "监视器不存在"}
          </AlertDescription>
        </Alert>
      </main>
    )

  async function submit(input: MonitorInput) {
    if (!monitorId) return
    setPending(true)
    try {
      await fetchJson(
        api.admin.monitors[":id"].$url({ param: { id: monitorId } }).toString(),
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(input),
        }
      )
      toast.success("监视器已更新")
      navigate(`/app/monitors/${monitorId}`)
    } finally {
      setPending(false)
    }
  }
  return (
    <main className="flex w-full flex-col gap-6 px-3 py-6 md:gap-7 md:px-8 md:py-8">
      <div className="flex flex-col gap-2">
        <p className="text-sm font-medium text-primary">监视器</p>
        <h1 className="font-serif text-4xl font-semibold">
          编辑 {data.monitor.name}
        </h1>
        <p className="text-muted-foreground">
          修改检测规则会重置状态并立即重新调度。
        </p>
      </div>
      <MonitorForm
        initial={editableMonitor(data.monitor)}
        pending={pending}
        submitLabel="保存更改"
        onSubmit={submit}
      />
    </main>
  )
}
