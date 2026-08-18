import type { InferResponseType } from "hono/client"
import useSWR from "swr"

import { api, swrConfig, unwrap } from "~/lib/api-client"

type SessionData = InferResponseType<typeof api.auth.session.$get, 200>

export function useSession(fallbackData?: SessionData) {
  return useSWR<SessionData>(
    "session",
    async () => unwrap(await api.auth.session.$get()),
    { ...swrConfig, fallbackData },
  )
}
