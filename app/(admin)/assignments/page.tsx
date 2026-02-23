import { prisma } from "@/lib/prisma"
import { AssignmentsClient } from "@/components/admin/assignments-client"
import { getTodayStart, getTodayEnd, serialize } from "@/lib/utils"

export const dynamic = 'force-dynamic'

export default async function AssignmentsPage() {
  const todayStart = getTodayStart()
  const todayEnd = getTodayEnd()

  const [workers, products, todayAssignments] = await Promise.all([
    prisma.worker.findMany({
      include: { user: { select: { email: true } } },
      orderBy: { name: "asc" },
    }),
    prisma.product.findMany({
      where: { stock: { gt: 0 } },
      include: { company: true },
      orderBy: [{ company: { name: "asc" } }, { name: "asc" }],
    }),
    prisma.assignment.findMany({
      where: { date: { gte: todayStart, lte: todayEnd } },
      include: {
        worker: true,
        product: { include: { company: true } },
        settlement: true,
      },
      orderBy: { date: "desc" },
    }),
  ])

  return (
    <AssignmentsClient
      initialWorkers={serialize(workers)}
      initialProducts={serialize(products)}
      initialAssignments={serialize(todayAssignments)}
    />
  )
}
