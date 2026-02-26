import { prisma } from "@/lib/prisma"
import { SettlementsClient } from "@/components/admin/settlements-client"
import { serialize } from "@/lib/utils"

export const dynamic = 'force-dynamic'

export default async function SettlementsPage() {
  const [closedAssignments, workers] = await Promise.all([
    prisma.assignment.findMany({
      where: { status: "CLOSED" },
      include: {
        worker: true,
        product: { include: { company: true } },
        dailySales: { orderBy: { date: "asc" } },
      },
      orderBy: { startDate: "desc" },
      take: 200,
    }),
    prisma.worker.findMany({ orderBy: { name: "asc" } }),
  ])

  const withTotals = closedAssignments.map((a) => {
    const totalSold = a.dailySales.reduce((sum, d) => sum + d.quantitySold, 0)
    const totalMerma = a.dailySales.reduce((sum, d) => sum + d.quantityMerma, 0)
    const totalDue = totalSold * Number(a.product.salePrice)
    const totalPaid = a.dailySales.reduce((sum, d) => sum + Number(d.amountPaid), 0)
    const pendingDebt = Math.max(0, totalDue - totalPaid)
    return { ...a, totalSold, totalMerma, totalDue, totalPaid, pendingDebt }
  })

  return <SettlementsClient initialAssignments={serialize(withTotals)} workers={serialize(workers)} />
}
