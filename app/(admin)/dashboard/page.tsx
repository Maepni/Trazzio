import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { formatCurrency, getTodayStart, getTodayEnd, serialize } from "@/lib/utils"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { DashboardChart } from "@/components/admin/dashboard-chart"
import {
  TrendingUp, PackageSearch, Users, AlertTriangle, Clock, BarChart3
} from "lucide-react"

export default async function DashboardPage() {
  const todayStart = getTodayStart()
  const todayEnd = getTodayEnd()

  const [
    settledToday,
    pendingWorkers,
    lowStockProducts_raw,
    totalWorkers,
  ] = await Promise.all([
    prisma.settlement.findMany({
      where: { settledAt: { gte: todayStart, lte: todayEnd } },
      include: { assignment: { include: { product: true, worker: true } } },
    }),
    prisma.assignment.findMany({
      where: { status: "PENDING", date: { gte: todayStart, lte: todayEnd } },
      include: { worker: true, product: true },
      distinct: ["workerId"],
    }),
    prisma.product.findMany({ include: { company: true } }),
    prisma.worker.count(),
  ])

  const lowStockProducts = lowStockProducts_raw
    .filter((p: any) => p.stock <= p.lowStockAlert)
    .slice(0, 5)

  const totalRevenue = settledToday.reduce(
    (sum: number, s: any) => sum + Number(s.amountDue),
    0
  )
  const totalProfit = settledToday.reduce((sum: number, s: any) => {
    const sold = s.totalSold
    const salePrice = Number(s.assignment.product.salePrice)
    const costPrice = Number(s.assignment.product.costPrice)
    return sum + sold * (salePrice - costPrice)
  }, 0)

  // Bar chart data: revenue per worker today
  const workerRevenueMap: Record<string, { name: string; revenue: number }> = {}
  for (const s of settledToday) {
    const wid = s.assignment.worker.id
    if (!workerRevenueMap[wid]) {
      workerRevenueMap[wid] = { name: s.assignment.worker.name.split(" ")[0], revenue: 0 }
    }
    workerRevenueMap[wid].revenue += Number(s.amountDue)
  }
  const chartData = Object.values(workerRevenueMap)

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-[#1e3a5f]">Resumen del Día</h1>
        <p className="text-gray-500 text-sm mt-1">
          {new Date().toLocaleDateString("es-PE", {
            weekday: "long",
            year: "numeric",
            month: "long",
            day: "numeric",
            timeZone: "America/Lima",
          })}
        </p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="border-0 shadow-sm">
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-gray-500 font-medium uppercase tracking-wide">
                Ventas Hoy
              </span>
              <div className="w-8 h-8 rounded-lg bg-green-50 flex items-center justify-center">
                <TrendingUp className="h-4 w-4 text-green-600" />
              </div>
            </div>
            <p className="text-2xl font-bold text-gray-900">
              {formatCurrency(totalRevenue)}
            </p>
            <p className="text-xs text-gray-400 mt-1">
              {settledToday.length} rendiciones
            </p>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-sm">
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-gray-500 font-medium uppercase tracking-wide">
                Ganancia
              </span>
              <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center">
                <TrendingUp className="h-4 w-4 text-blue-600" />
              </div>
            </div>
            <p className="text-2xl font-bold text-gray-900">
              {formatCurrency(totalProfit)}
            </p>
            <p className="text-xs text-gray-400 mt-1">margen neto</p>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-sm">
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-gray-500 font-medium uppercase tracking-wide">
                Pendientes
              </span>
              <div className="w-8 h-8 rounded-lg bg-orange-50 flex items-center justify-center">
                <Clock className="h-4 w-4 text-orange-500" />
              </div>
            </div>
            <p className="text-2xl font-bold text-gray-900">
              {pendingWorkers.length}
            </p>
            <p className="text-xs text-gray-400 mt-1">trabajadores</p>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-sm">
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-gray-500 font-medium uppercase tracking-wide">
                Stock Bajo
              </span>
              <div className="w-8 h-8 rounded-lg bg-red-50 flex items-center justify-center">
                <AlertTriangle className="h-4 w-4 text-red-500" />
              </div>
            </div>
            <p className="text-2xl font-bold text-gray-900">
              {lowStockProducts.length}
            </p>
            <p className="text-xs text-gray-400 mt-1">productos</p>
          </CardContent>
        </Card>
      </div>

      {/* Bar chart */}
      <Card className="border-0 shadow-sm">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold text-gray-700 flex items-center gap-2">
            <BarChart3 className="h-4 w-4 text-[#1e3a5f]" />
            Ventas por trabajador hoy
          </CardTitle>
        </CardHeader>
        <CardContent>
          <DashboardChart data={chartData} />
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card className="border-0 shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold text-gray-700 flex items-center gap-2">
              <Clock className="h-4 w-4 text-orange-500" />
              Trabajadores con rendición pendiente
            </CardTitle>
          </CardHeader>
          <CardContent>
            {pendingWorkers.length === 0 ? (
              <p className="text-sm text-gray-400 py-4 text-center">
                Todos rindieron hoy 🎉
              </p>
            ) : (
              <div className="space-y-2">
                {pendingWorkers.map((a: any) => (
                  <div
                    key={a.id}
                    className="flex items-center justify-between py-2 border-b last:border-0"
                  >
                    <span className="text-sm font-medium text-gray-700">
                      {a.worker.name}
                    </span>
                    <Badge variant="secondary" className="bg-orange-50 text-orange-600 text-xs">
                      Pendiente
                    </Badge>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="border-0 shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold text-gray-700 flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-red-500" />
              Alertas de stock bajo
            </CardTitle>
          </CardHeader>
          <CardContent>
            {lowStockProducts.length === 0 ? (
              <p className="text-sm text-gray-400 py-4 text-center">
                Stock en niveles normales ✓
              </p>
            ) : (
              <div className="space-y-2">
                {lowStockProducts.map((p: any) => (
                  <div
                    key={p.id}
                    className="flex items-center justify-between py-2 border-b last:border-0"
                  >
                    <div>
                      <p className="text-sm font-medium text-gray-700">{p.name}</p>
                      <p className="text-xs text-gray-400">{p.company.name}</p>
                    </div>
                    <Badge variant="destructive" className="text-xs">
                      {p.stock} und.
                    </Badge>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
