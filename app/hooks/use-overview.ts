import type { InferResponseType } from "hono/client"
import useSWR from "swr"

import { api, swrConfig, unwrap } from "~/lib/api-client"

export type OverviewData = InferResponseType<typeof api.admin.overview.$get, 200>

export function useOverview() {
  return useSWR<OverviewData>(
    "overview",
    async () => unwrap(await api.admin.overview.$get()),
    { ...swrConfig, refreshInterval: 10000 },
  )
}
