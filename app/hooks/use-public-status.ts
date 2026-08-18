import type { InferResponseType } from "hono/client"
import useSWR from "swr"

import { api, swrConfig, unwrap } from "~/lib/api-client"

export type PublicStatusData = InferResponseType<typeof api.public.status.$get>

export function usePublicStatus() {
  return useSWR<PublicStatusData>(
    "public-status",
    async () => {
      const response = await api.public.status.$get()
      return unwrap<PublicStatusData>(
        response as Response & { json(): Promise<PublicStatusData> }
      )
    },
    { ...swrConfig, refreshInterval: 30000 }
  )
}
