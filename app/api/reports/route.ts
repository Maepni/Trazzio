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

  const dateWhere: any = {}
  if (from || to) {
    dateWhere.date = {
      ...(from && { gte: new Date(from) }),
      ...(to && { lte: new Date(to + "T23:59:59") }),
    }
  }

  const dailySales = await prisma.dailySale.findMany({
    where: dateWhere,
    include: {
      assignment: {
        include: {
          worker: true,
          product: { include: { company: true } },
        },
      },
    },
    orderBy: { date: "asc" },
  })

  const filtered = dailySales.filter((d: any) => {
    if (workerId && d.assignment.workerId !== workerId) return false
    if (companyId && d.assignment.product.companyId !== companyId) return false
    return true
  })

  const totalRevenue = filtered.reduce(
    (sum: number, d: any) => sum + d.quantitySold * Number(d.assignment.product.salePrice),
    0
  )
  const totalProfit = filtered.reduce((sum: number, d: any) => {
    const margin = Number(d.assignment.product.salePrice) - Number(d.assignment.product.costPrice)
    return sum + d.quantitySold * margin
  }, 0)
  const totalMerma = filtered.reduce((sum: number, d: any) => sum + d.quantityMerma, 0)

  // Daily breakdown for profit chart
  const dailyMap: Record<string, { date: string; profit: number; revenue: number }> = {}
  for (const d of filtered) {
    const date = new Date(d.date).toISOString().split("T")[0]
    if (!dailyMap[date]) dailyMap[date] = { date, profit: 0, revenue: 0 }
    const margin = Number(d.assignment.product.salePrice) - Number(d.assignment.product.costPrice)
    dailyMap[date].profit += d.quantitySold * margin
    dailyMap[date].revenue += d.quantitySold * Number(d.assignment.product.salePrice)
  }
  const dailyBreakdown = Object.values(dailyMap).sort((a, b) => a.date.localeCompare(b.date))

  return NextResponse.json({ dailySales: filtered, totalRevenue, totalProfit, totalMerma, dailyBreakdown })
}
