import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { formatCurrency, getTodayStart, getTodayEnd } from "@/lib/utils"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { DashboardChart } from "@/components/admin/dashboard-chart"
import {
  TrendingUp, AlertTriangle, Clock, BarChart3
} from "lucide-react"

export const dynamic = 'force-dynamic'

export default async function DashboardPage() {
  const session = await auth()
  const todayStart = getTodayStart()
  const todayEnd = getTodayEnd()

  const [todaySales, activeAssignments, lowStockProducts_raw] = await Promise.all([
    prisma.dailySale.findMany({
      where: { date: { gte: todayStart, lte: todayEnd } },
      include: {
        assignment: { include: { product: true, worker: true } },
      },
    }),
    prisma.assignment.findMany({
      where: { status: "ACTIVE" },
      include: { worker: true, product: true },
      distinct: ["workerId"],
    }),
    prisma.product.findMany({ include: { company: true } }),
  ])

  const lowStockProducts = lowStockProducts_raw
    .filter((p: any) => p.stock <= p.lowStockAlert)
    .slice(0, 5)

  const totalRevenue = todaySales.reduce(
    (sum: number, d: any) => sum + d.quantitySold * Number(d.assignment.product.salePrice),
    0
  )
  const totalProfit = todaySales.reduce((sum: number, d: any) => {
    const margin = Number(d.assignment.product.salePrice) - Number(d.assignment.product.costPrice)
    return sum + d.quantitySold * margin
  }, 0)

  // Bar chart: revenue por trabajador hoy
  const workerRevenueMap: Record<string, { name: string; revenue: number }> = {}
  for (const d of todaySales) {
    const wid = d.assignment.worker.id
    if (!workerRevenueMap[wid]) {
      workerRevenueMap[wid] = { name: d.assignment.worker.name.split(" ")[0], revenue: 0 }
    }
    workerRevenueMap[wid].revenue += d.quantitySold * Number(d.assignment.product.salePrice)
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
              {todaySales.length} registros
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
                Asignaciones
              </span>
              <div className="w-8 h-8 rounded-lg bg-orange-50 flex items-center justify-center">
                <Clock className="h-4 w-4 text-orange-500" />
              </div>
            </div>
            <p className="text-2xl font-bold text-gray-900">
              {activeAssignments.length}
            </p>
            <p className="text-xs text-gray-400 mt-1">activas hoy</p>
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
              Trabajadores con asignaciones activas
            </CardTitle>
          </CardHeader>
          <CardContent>
            {activeAssignments.length === 0 ? (
              <p className="text-sm text-gray-400 py-4 text-center">
                Sin asignaciones activas
              </p>
            ) : (
              <div className="space-y-2">
                {activeAssignments.map((a: any) => (
                  <div
                    key={a.id}
                    className="flex items-center justify-between py-2 border-b last:border-0"
                  >
                    <span className="text-sm font-medium text-gray-700">
                      {a.worker.name}
                    </span>
                    <Badge variant="secondary" className="bg-blue-50 text-blue-600 text-xs">
                      Activa
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
