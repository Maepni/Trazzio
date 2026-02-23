import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { auth } from "@/lib/auth"

export async function GET(req: Request) {
  const session = await auth()
  if (!session || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 })
  }
  const { searchParams } = new URL(req.url)
  const from = searchParams.get("from")
  const to = searchParams.get("to")
  const workerId = searchParams.get("workerId")
  const companyId = searchParams.get("companyId")

  const settlementWhere: any = {}
  if (from || to) {
    settlementWhere.settledAt = {
      ...(from && { gte: new Date(from) }),
      ...(to && { lte: new Date(to + "T23:59:59") }),
    }
  }

  const settlements = await prisma.settlement.findMany({
    where: settlementWhere,
    include: { assignment: { include: { worker: true, product: { include: { company: true } }, mermaItems: { include: { product: true } } } } },
    orderBy: { settledAt: "asc" },
  })

  const filtered = settlements.filter((s: any) => {
    if (workerId && s.assignment.workerId !== workerId) return false
    if (companyId && s.assignment.product.companyId !== companyId) return false
    return true
  })

  const totalRevenue = filtered.reduce((sum: number, s: any) => sum + Number(s.amountDue), 0)
  const totalProfit = filtered.reduce((sum: number, s: any) => {
    const effectiveSalePrice = Number(s.assignment.customSalePrice ?? s.assignment.product.salePrice)
    const costPrice = Number(s.assignment.product.costPrice)
    const margin = effectiveSalePrice - costPrice
    return sum + s.totalSold * margin
  }, 0)
  const totalMerma = filtered.reduce((sum: number, s: any) => sum + s.totalMerma, 0)

  // Daily breakdown for profit chart
  const dailyMap: Record<string, { date: string; profit: number; revenue: number }> = {}
  for (const s of filtered) {
    const date = new Date(s.settledAt).toISOString().split("T")[0]
    if (!dailyMap[date]) dailyMap[date] = { date, profit: 0, revenue: 0 }
    const effectiveSalePrice = Number(s.assignment.customSalePrice ?? s.assignment.product.salePrice)
    const costPrice = Number(s.assignment.product.costPrice)
    const margin = effectiveSalePrice - costPrice
    dailyMap[date].profit += s.totalSold * margin
    dailyMap[date].revenue += Number(s.amountDue)
  }
  const dailyBreakdown = Object.values(dailyMap).sort((a, b) => a.date.localeCompare(b.date))

  return NextResponse.json({ settlements: filtered, totalRevenue, totalProfit, totalMerma, dailyBreakdown })
}
