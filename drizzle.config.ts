import { defineConfig } from "drizzle-kit"
import path from "node:path"

const dataDir = process.env.MONOMI_DATA_DIR ?? "./data"

export default defineConfig({
  dialect: "sqlite",
  schema: "./server/db/schema.ts",
  out: "./drizzle",
  dbCredentials: {
    url: path.join(dataDir, "monomi.db"),
  },
})
