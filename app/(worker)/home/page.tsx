import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { redirect } from "next/navigation"
import { WorkerHome } from "@/components/worker/worker-home"
import { getTodayStart, getTodayEnd, serialize } from "@/lib/utils"

export default async function WorkerHomePage() {
  const session = await auth()
  if (!session || !session.user.workerId) redirect("/login")

  const todayStart = getTodayStart()
  const todayEnd = getTodayEnd()

  const assignments = await prisma.assignment.findMany({
    where: {
      workerId: session.user.workerId,
      date: { gte: todayStart, lte: todayEnd },
    },
    include: {
      product: { include: { company: true } },
      settlement: true,
      mermaItems: true,
    },
    orderBy: { date: "desc" },
  })

  return (
    <WorkerHome
      assignments={serialize(assignments)}
      workerName={session.user.workerName ?? "Trabajador"}
    />
  )
}
