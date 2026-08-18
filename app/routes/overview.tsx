import { AdminShell } from "~/components/admin-shell"
import { OverviewDashboard } from "~/components/overview-dashboard"

export function meta() {
  return [
    { title: "运行总览 · Monomi" },
    { name: "description", content: "Monomi 服务运行与监控总览" },
  ]
}

export default function OverviewRoute() {
  return (
    <AdminShell>
      <OverviewDashboard />
    </AdminShell>
  )
}
