import { createApp } from "./app"
import { parseConfig } from "./config"
import { createRuntime } from "./runtime"

export async function startServer() {
  const config = parseConfig()
  const runtime = await createRuntime(config)
  const app = createApp(runtime.deps)
  const server = Bun.serve({
    hostname: config.host,
    port: config.port,
    fetch: app.fetch,
  })
  let stopping = false

  async function stop() {
    if (stopping) return
    stopping = true
    await server.stop(false)
    await runtime.stop()
    process.exit(0)
  }

  process.once("SIGINT", () => void stop())
  process.once("SIGTERM", () => void stop())
  console.log(`Started server: ${server.url}`)
  return { server, runtime }
}

if (import.meta.main) await startServer()
