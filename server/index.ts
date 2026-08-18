import { createApp } from "./app"
import { parseConfig } from "./config"
import { createRuntime } from "./runtime"

const config = parseConfig()
const runtime = await createRuntime(config)
const app = createApp(runtime.deps)
let stopping = false

async function stop() {
  if (stopping) return
  stopping = true
  await runtime.stop()
  process.exit(0)
}

process.once("SIGINT", () => void stop())
process.once("SIGTERM", () => void stop())

export default {
  hostname: config.host,
  port: config.port,
  fetch: app.fetch,
}
