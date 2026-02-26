import { prisma } from "@/lib/prisma"
import { AssignmentsClient } from "@/components/admin/assignments-client"
import { serialize } from "@/lib/utils"

export const dynamic = 'force-dynamic'

export default async function AssignmentsPage() {
  const [workers, products, activeAssignments] = await Promise.all([
    prisma.worker.findMany({
      include: { user: { select: { username: true } } },
      orderBy: { name: "asc" },
    }),
    prisma.product.findMany({
      where: { stock: { gt: 0 } },
      include: { company: true },
      orderBy: [{ company: { name: "asc" } }, { name: "asc" }],
    }),
    prisma.assignment.findMany({
      where: { status: "ACTIVE" },
      include: {
        worker: true,
        product: { include: { company: true } },
        dailySales: { orderBy: { date: "asc" } },
      },
      orderBy: { startDate: "desc" },
    }),
  ])

  const assignmentsWithTotals = activeAssignments.map((a) => {
    const totalSold = a.dailySales.reduce((sum, d) => sum + d.quantitySold, 0)
    const totalMerma = a.dailySales.reduce((sum, d) => sum + d.quantityMerma, 0)
    const remaining = a.quantityAssigned - totalSold - totalMerma
    const totalDue = totalSold * Number(a.product.salePrice)
    const totalPaid = a.dailySales.reduce((sum, d) => sum + Number(d.amountPaid), 0)
    const pendingDebt = Math.max(0, totalDue - totalPaid)
    return { ...a, totalSold, totalMerma, remaining, totalDue, totalPaid, pendingDebt }
  })

  return (
    <AssignmentsClient
      initialWorkers={serialize(workers)}
      initialProducts={serialize(products)}
      initialAssignments={serialize(assignmentsWithTotals)}
    />
  )
}
