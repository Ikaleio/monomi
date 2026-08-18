import { reactRouter } from "@react-router/dev/vite"
import tailwindcss from "@tailwindcss/vite"
import { defineConfig } from "vite"

export default defineConfig({
  resolve: {
    tsconfigPaths: true,
  },
  server: {
    proxy: {
      "/api": {
        target: "http://127.0.0.1:3001",
        headers: {
          "X-Forwarded-Host": "localhost:5173",
          "X-Forwarded-Proto": "http",
        },
      },
      "/health": {
        target: "http://127.0.0.1:3001",
        headers: {
          "X-Forwarded-Host": "localhost:5173",
          "X-Forwarded-Proto": "http",
        },
      },
      "/uploads": {
        target: "http://127.0.0.1:3001",
        headers: {
          "X-Forwarded-Host": "localhost:5173",
          "X-Forwarded-Proto": "http",
        },
      },
    },
  },
  plugins: [tailwindcss(), reactRouter()],
})
