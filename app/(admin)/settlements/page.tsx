import { prisma } from "@/lib/prisma"
import { SettlementsClient } from "@/components/admin/settlements-client"
import { getTodayStart, getTodayEnd, serialize } from "@/lib/utils"

export const dynamic = 'force-dynamic'

export default async function SettlementsPage() {
  const todayStart = getTodayStart()
  const todayEnd = getTodayEnd()

  const [settlements, workers] = await Promise.all([
    prisma.settlement.findMany({
      where: { settledAt: { gte: todayStart, lte: todayEnd } },
      include: {
        assignment: {
          include: {
            worker: true,
            product: { include: { company: true } },
            mermaItems: { include: { product: true } },
          },
        },
      },
      orderBy: { settledAt: "desc" },
    }),
    prisma.worker.findMany({ orderBy: { name: "asc" } }),
  ])

  return <SettlementsClient initialSettlements={serialize(settlements)} workers={serialize(workers)} />
}
