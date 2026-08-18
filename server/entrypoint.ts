import { lchown, mkdir, readdir } from "node:fs/promises"
import path from "node:path"

import { startServer } from "./index"

const dataDir = process.env.MONOMI_DATA_DIR ?? "/data"

async function chownTree(directory: string, uid: number, gid: number) {
  const entries = await readdir(directory, { withFileTypes: true })
  for (const entry of entries) {
    const entryPath = path.join(directory, entry.name)
    if (entry.isDirectory()) await chownTree(entryPath, uid, gid)
    await lchown(entryPath, uid, gid)
  }
  await lchown(directory, uid, gid)
}

await mkdir(dataDir, { recursive: true })
const { getuid, setgroups, setgid, setuid } = process
if (getuid?.() === 0) {
  if (!setgroups || !setgid || !setuid) {
    throw new Error("This platform cannot drop root privileges")
  }
  await chownTree(dataDir, 1000, 1000)
  setgroups([])
  setgid(1000)
  setuid(1000)
}

await startServer()
