import type { InferResponseType } from "hono/client"
import useSWR from "swr"

import { api, swrConfig, unwrap } from "~/lib/api-client"

export type IncidentsData = InferResponseType<
  typeof api.admin.incidents.$get,
  200
>

export function useIncidents(status?: "ongoing" | "resolved") {
  return useSWR<IncidentsData>(
    ["incidents", status ?? "all"],
    async () =>
      unwrap(
        await api.admin.incidents.$get({
          query: { limit: "100", ...(status ? { status } : {}) },
        })
      ),
    { ...swrConfig, refreshInterval: 10000 }
  )
}
