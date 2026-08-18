import { Outlet, redirect, useLoaderData } from "react-router"
import { SWRConfig } from "swr"

import { AdminShell } from "~/components/admin-shell"
import { loadAuthState } from "~/lib/auth-loader"

export async function clientLoader({ request }: { request: Request }) {
  const state = await loadAuthState()
  if (!state.setup.initialized) throw redirect("/setup")
  if (!state.session.authenticated) {
    const url = new URL(request.url)
    const next = `${url.pathname}${url.search}`
    throw redirect(`/login?next=${encodeURIComponent(next)}`)
  }
  return state
}

export default function AppLayoutRoute() {
  const state = useLoaderData<typeof clientLoader>()
  return (
    <SWRConfig value={{ fallback: { session: state.session } }}>
      <AdminShell>
        <Outlet />
      </AdminShell>
    </SWRConfig>
  )
}
