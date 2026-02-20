import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { redirect } from "next/navigation"
import { SettleForm } from "@/components/worker/settle-form"
import { getTodayStart, getTodayEnd, serialize } from "@/lib/utils"

export default async function SettlePage() {
  const session = await auth()
  if (!session || !session.user.workerId) redirect("/login")

  const todayStart = getTodayStart()
  const todayEnd = getTodayEnd()

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
