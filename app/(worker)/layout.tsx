import { WorkerBottomNav } from "@/components/worker/worker-bottom-nav"
import { WorkerHeader } from "@/components/worker/worker-header"

export default function WorkerLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex flex-col min-h-screen bg-gray-50">
      <WorkerHeader />
      <main className="flex-1 pb-20">{children}</main>
      <WorkerBottomNav />
    </div>
  )
}
