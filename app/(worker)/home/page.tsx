import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { redirect } from "next/navigation"
import { WorkerHome } from "@/components/worker/worker-home"
import { serialize } from "@/lib/utils"

export const dynamic = 'force-dynamic'

export default async function WorkerHomePage() {
  const session = await auth()
  if (!session || !session.user.workerId) redirect("/login")

  const assignments = await prisma.assignment.findMany({
    where: {
      workerId: session.user.workerId,
      status: "ACTIVE",
    },
    include: {
      product: { include: { company: true } },
      dailySales: { orderBy: { date: "asc" } },
    },
    orderBy: { startDate: "desc" },
  })

  const withTotals = assignments.map((a) => {
    const totalSold = a.dailySales.reduce((sum, d) => sum + d.quantitySold, 0)
    const totalMerma = a.dailySales.reduce((sum, d) => sum + d.quantityMerma, 0)
    const remaining = a.quantityAssigned - totalSold - totalMerma
    const totalDue = totalSold * Number(a.product.salePrice)
    const totalPaid = a.dailySales.reduce((sum, d) => sum + Number(d.amountPaid), 0)
    const pendingDebt = Math.max(0, totalDue - totalPaid)
    return { ...a, totalSold, totalMerma, remaining, totalDue, totalPaid, pendingDebt }
  })

  return (
    <WorkerHome
      assignments={serialize(withTotals)}
      workerName={session.user.workerName ?? "Trabajador"}
    />
  )
}
