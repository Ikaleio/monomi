import type { InferResponseType } from "hono/client"
import useSWR from "swr"

import { api, swrConfig, unwrap } from "~/lib/api-client"

export type SettingsData = InferResponseType<typeof api.admin.settings.$get, 200>
export type StatusPageData = InferResponseType<
  (typeof api.admin)["status-page"]["$get"],
  200
>

export function useSettings() {
  return useSWR<SettingsData>(
    "settings",
    async () => unwrap(await api.admin.settings.$get()),
    swrConfig,
  )
}

export function useStatusPageSettings() {
  return useSWR<StatusPageData>(
    "status-page-settings",
    async () => unwrap(await api.admin["status-page"].$get()),
    swrConfig,
  )
}
