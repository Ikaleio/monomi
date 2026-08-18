import { PublicStatusPage } from "~/components/public-status-page"

export function meta() {
  return [
    { title: "Monomi 服务状态" },
    { name: "description", content: "Monomi 核心服务实时可用性与事件记录" },
  ]
}

export default function Home() {
  return <PublicStatusPage />
}
