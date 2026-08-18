import { chown, mkdir } from "node:fs/promises"

const dataDir = process.env.MONOMI_DATA_DIR ?? "/data"
const isRoot = process.getuid?.() === 0

await mkdir(dataDir, { recursive: true })
if (isRoot) await chown(dataDir, 1000, 1000)

const server = Bun.spawn(["bun", "server/index.ts"], {
  cwd: process.cwd(),
  env: process.env,
  stdin: "inherit",
  stdout: "inherit",
  stderr: "inherit",
  ...(isRoot ? { uid: 1000, gid: 1000 } : {}),
})

process.on("SIGINT", () => server.kill("SIGINT"))
process.on("SIGTERM", () => server.kill("SIGTERM"))
process.exit(await server.exited)
