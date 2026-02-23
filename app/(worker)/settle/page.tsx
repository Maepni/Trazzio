import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { redirect } from "next/navigation"
import { SettleForm } from "@/components/worker/settle-form"
import { getTodayStart, getTodayEnd, serialize } from "@/lib/utils"

export const dynamic = 'force-dynamic'

export default async function SettlePage() {
  const session = await auth()
  if (!session || !session.user.workerId) redirect("/login")

  const todayStart = getTodayStart()
  const todayEnd = getTodayEnd()

  // customSalePrice es un campo escalar del modelo Assignment (no una relación),
  // por lo que Prisma lo devuelve automáticamente sin necesidad de incluirlo explícitamente.
  const pendingAssignments = await prisma.assignment.findMany({
    where: {
      workerId: session.user.workerId,
      status: "PENDING",
      date: { gte: todayStart, lte: todayEnd },
    },
    include: { product: { include: { company: true } } },
    orderBy: { date: "asc" },
  })

  return <SettleForm assignments={serialize(pendingAssignments)} />
}
