import { api, unwrap } from "~/lib/api-client"

export async function loadAuthState() {
  const [setup, session] = await Promise.all([
    unwrap(await api.setup.status.$get()),
    unwrap(await api.auth.session.$get()),
  ])
  return { setup, session }
}

export function safeNext(requestUrl: string, fallback = "/app") {
  const value = new URL(requestUrl).searchParams.get("next")
  return value && value.startsWith("/") && !value.startsWith("//")
    ? value
    : fallback
}
