// Historial de asignaciones cerradas (reemplaza el antiguo settlements)
import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { auth } from "@/lib/auth"

export const dynamic = 'force-dynamic'

export async function GET(req: Request) {
  const session = await auth()
  if (!session || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 })
  }

  const { searchParams } = new URL(req.url)
  const from = searchParams.get("from")
  const to = searchParams.get("to")
  const workerId = searchParams.get("workerId")

  const where: any = { status: "CLOSED" }
  if (from || to) {
    where.startDate = {
      ...(from && { gte: new Date(from) }),
      ...(to && { lte: new Date(to + "T23:59:59") }),
    }
  }

  const assignments = await prisma.assignment.findMany({
    where,
    include: {
      worker: true,
      product: { include: { company: true } },
      dailySales: { orderBy: { date: "asc" } },
    },
    orderBy: { startDate: "desc" },
    take: 200,
  })

  const filtered = workerId ? assignments.filter((a: any) => a.workerId === workerId) : assignments

  const withTotals = filtered.map((a: any) => {
    const totalSold = a.dailySales.reduce((sum: number, d: any) => sum + d.quantitySold, 0)
    const totalMerma = a.dailySales.reduce((sum: number, d: any) => sum + d.quantityMerma, 0)
    const totalDue = totalSold * Number(a.product.salePrice)
    const totalPaid = a.dailySales.reduce((sum: number, d: any) => sum + Number(d.amountPaid), 0)
    const pendingDebt = Math.max(0, totalDue - totalPaid)
    return { ...a, totalSold, totalMerma, totalDue, totalPaid, pendingDebt }
  })

  return NextResponse.json(withTotals)
}
