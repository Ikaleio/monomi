import type { InferResponseType } from "hono/client"
import useSWR from "swr"

import { api, swrConfig, unwrap } from "~/lib/api-client"

export type MonitorsData = InferResponseType<typeof api.admin.monitors.$get, 200>
export type MonitorDetailData = InferResponseType<
  (typeof api.admin.monitors)[":id"]["$get"],
  200
>
export type MonitorChecksData = InferResponseType<
  (typeof api.admin.monitors)[":id"]["checks"]["$get"],
  200
>

export function useMonitors() {
  return useSWR<MonitorsData>(
    "monitors",
    async () => unwrap(await api.admin.monitors.$get()),
    { ...swrConfig, refreshInterval: 10000 },
  )
}

export function useMonitor(id?: string) {
  return useSWR<MonitorDetailData>(
    id ? ["monitor", id] : null,
    async () =>
      unwrap(
        await api.admin.monitors[":id"].$get({ param: { id: id as string } }),
      ),
    { ...swrConfig, refreshInterval: 10000 },
  )
}

export function useMonitorActivity(id?: string) {
  return useSWR(
    id ? ["monitor-activity", id] : null,
    async () => {
      const param = { id: id as string }
      const [checks, metrics, history] = await Promise.all([
        unwrap(await api.admin.monitors[":id"].checks.$get({ param })),
        unwrap(await api.admin.monitors[":id"].metrics.$get({ param })),
        unwrap(await api.admin.monitors[":id"].history.$get({ param })),
      ])
      return { checks, metrics, history }
    },
    { ...swrConfig, refreshInterval: 10000 },
  )
}
