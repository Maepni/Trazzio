import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { redirect } from "next/navigation"
import { WorkerHome } from "@/components/worker/worker-home"
import { getTodayStart, getTodayEnd, serialize } from "@/lib/utils"

export const dynamic = 'force-dynamic'

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

  // Calcular balance pendiente del trabajador
  let pendingBalance = 0
  const workerWithData = await prisma.worker.findUnique({
    where: { id: session.user.workerId },
    include: {
      payments: true,
      assignments: {
        where: { status: "SETTLED" },
        include: { settlement: true },
      },
    },
  })

  if (workerWithData) {
    const totalEarned = workerWithData.assignments.reduce((acc, a) => {
      if (!a.settlement) return acc
      const amountDue = Number(a.settlement.amountDue)
      return acc + (
        workerWithData.commissionType === "PERCENTAGE"
          ? amountDue * (Number(workerWithData.commission) / 100)
          : (a.quantitySold ?? 0) * Number(workerWithData.commission)
      )
    }, 0)
    const totalPaid = workerWithData.payments.reduce((acc, p) => acc + Number(p.amount), 0)
    pendingBalance = Math.max(0, Math.round((totalEarned - totalPaid) * 100) / 100)
  }

  return (
    <WorkerHome
      assignments={serialize(assignments)}
      workerName={session.user.workerName ?? "Trabajador"}
      pendingBalance={pendingBalance}
    />
  )
}
