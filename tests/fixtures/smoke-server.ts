let failing = false
const events: unknown[] = []

Bun.serve({
  hostname: "127.0.0.1",
  port: 3200,
  async fetch(request) {
    const url = new URL(request.url)
    if (url.pathname === "/service") {
      return failing
        ? new Response("FAILED", { status: 503 })
        : new Response("READY", { status: 200 })
    }
    if (url.pathname === "/toggle" && request.method === "POST") {
      failing = url.searchParams.get("failing") === "true"
      return Response.json({ failing })
    }
    if (url.pathname === "/webhook" && request.method === "POST") {
      events.push(await request.json())
      return new Response(null, { status: 204 })
    }
    if (url.pathname === "/events") return Response.json({ events })
    return new Response("Not Found", { status: 404 })
  },
})

console.log("Smoke fixture listening on 3200")
