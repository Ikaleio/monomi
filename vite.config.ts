import { reactRouter } from "@react-router/dev/vite"
import tailwindcss from "@tailwindcss/vite"
import { defineConfig } from "vite"

export default defineConfig({
  resolve: {
    alias: [
      { find: /^react-dom\/server$/, replacement: "react-dom/server.node" },
    ],
    tsconfigPaths: true,
  },
  server: {
    proxy: {
      "/api": "http://127.0.0.1:3001",
      "/health": "http://127.0.0.1:3001",
      "/uploads": "http://127.0.0.1:3001",
    },
  },
  plugins: [tailwindcss(), reactRouter()],
})
