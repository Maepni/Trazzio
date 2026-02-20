"use client"

import { useState, useMemo } from "react"
import { useQuery } from "@tanstack/react-query"
import { useRouter } from "next/navigation"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { formatCurrency, formatDate, formatUnitsToBoxes } from "@/lib/utils"
import {
  ResponsiveContainer, LineChart, Line, XAxis, YAxis,
  CartesianGrid, Tooltip as RechartsTooltip
} from "recharts"
import {
  Users, Package, AlertTriangle, TrendingUp, BarChart3,
  Filter, Calendar, Building2, ArrowRight
} from "lucide-react"

// ─── Tab definitions ─────────────────────────────────────────────────────────
const TABS = [
  { id: "workers",   label: "Por Trabajador", icon: Users },
  { id: "inventory", label: "Inventario",      icon: Package },
  { id: "merma",     label: "Merma",           icon: AlertTriangle },
  { id: "profits",   label: "Ganancias",       icon: TrendingUp },
  { id: "lowstock",  label: "Stock Bajo",      icon: BarChart3 },
] as const
type TabId = typeof TABS[number]["id"]

// ─── Helpers ──────────────────────────────────────────────────────────────────
function groupByWeek(dailyBreakdown: any[]) {
  const weeks: Record<string, { date: string; profit: number; revenue: number }> = {}
  for (const d of dailyBreakdown) {
    const dt = new Date(d.date)
    const mon = new Date(dt)
    mon.setDate(dt.getDate() - ((dt.getDay() + 6) % 7))
    const key = mon.toISOString().split("T")[0]
    if (!weeks[key]) weeks[key] = { date: key, profit: 0, revenue: 0 }
    weeks[key].profit += d.profit
    weeks[key].revenue += d.revenue
  }
  return Object.values(weeks).sort((a, b) => a.date.localeCompare(b.date))
}

function groupByMonth(dailyBreakdown: any[]) {
  const months: Record<string, { date: string; profit: number; revenue: number }> = {}
  for (const d of dailyBreakdown) {
    const key = d.date.slice(0, 7)
    if (!months[key]) months[key] = { date: key, profit: 0, revenue: 0 }
    months[key].profit += d.profit
    months[key].revenue += d.revenue
  }
  return Object.values(months).sort((a, b) => a.date.localeCompare(b.date))
}

function calcCommission(worker: any, revenue: number, daysWorked: number) {
  if (worker.commissionType === "PERCENTAGE") return revenue * (Number(worker.commission) / 100)
  return Number(worker.commission) * daysWorked
}

// ─── Custom recharts tooltip ──────────────────────────────────────────────────
function CustomTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-white border border-gray-100 rounded-xl shadow-lg px-4 py-3 text-sm">
      <p className="text-gray-500 text-xs mb-1">{label}</p>
      {payload.map((p: any) => (
        <p key={p.name} style={{ color: p.color }} className="font-semibold">
          {p.name}: {formatCurrency(p.value)}
        </p>
      ))}
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────
interface Props { workers: any[]; companies: any[]; products: any[] }

export function ReportsClient({ workers, companies, products }: Props) {
  const router = useRouter()
  const today = new Date().toISOString().split("T")[0]
  const thirtyAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split("T")[0]

  const [activeTab, setActiveTab] = useState<TabId>("workers")
  const [filters, setFilters] = useState({ from: thirtyAgo, to: today, workerId: "", companyId: "" })
  const [profitGranularity, setProfitGranularity] = useState<"day" | "week" | "month">("day")

  const params = new URLSearchParams()
  if (filters.from) params.set("from", filters.from)
  if (filters.to) params.set("to", filters.to)
  if (filters.workerId) params.set("workerId", filters.workerId)
  if (filters.companyId) params.set("companyId", filters.companyId)

  const { data, isLoading } = useQuery({
    queryKey: ["reports", filters],
    queryFn: async () => {
      const r = await fetch(`/api/reports?${params.toString()}`)
      return r.json()
    },
  })

  const settlements: any[] = data?.settlements ?? []
  const dailyBreakdown: any[] = data?.dailyBreakdown ?? []
  const totalRevenue: number = data?.totalRevenue ?? 0
  const totalProfit: number = data?.totalProfit ?? 0
  const totalMerma: number = data?.totalMerma ?? 0

  // ── Tab 1: Worker stats ──────────────────────────────────────────────────
  const workerStats = useMemo(() => workers.map((w) => {
    const ws = settlements.filter((s) => s.assignment.workerId === w.id)
    const revenue = ws.reduce((sum, s) => sum + Number(s.amountDue), 0)
    const sold = ws.reduce((sum, s) => sum + s.totalSold, 0)
    const merma = ws.reduce((sum, s) => sum + s.totalMerma, 0)
    const dates = new Set(ws.map((s) => new Date(s.settledAt).toISOString().split("T")[0]))
    const daysWorked = dates.size
    const commission = calcCommission(w, revenue, daysWorked)
    const profit = ws.reduce((sum, s) => {
      const margin = Number(s.assignment.product.salePrice) - Number(s.assignment.product.costPrice)
      return sum + s.totalSold * margin
    }, 0) - commission
    return { ...w, revenue, sold, merma, daysWorked, commission, profit, count: ws.length }
  }).filter(w => w.count > 0), [workers, settlements])

  // ── Tab 3: Merma stats ───────────────────────────────────────────────────
  const mermaStats = useMemo(() => {
    const map: Record<string, { productId: string; productName: string; companyName: string; costPrice: number; units: number }> = {}
    for (const s of settlements) {
      for (const m of (s.assignment.mermaItems ?? [])) {
        const pid = m.productId
        if (!map[pid]) {
          const prod = products.find(p => p.id === pid) ?? s.assignment.product
          map[pid] = {
            productId: pid,
            productName: prod?.name ?? "—",
            companyName: prod?.company?.name ?? "—",
            costPrice: Number(prod?.costPrice ?? 0),
            units: 0,
          }
        }
        map[pid].units += m.quantity
      }
    }
    return Object.values(map).sort((a, b) => b.units - a.units)
  }, [settlements, products])

  const totalMermaCost = mermaStats.reduce((s, m) => s + m.units * m.costPrice, 0)

  // ── Tab 4: Profit chart data ──────────────────────────────────────────────
  const chartData = useMemo(() => {
    if (profitGranularity === "week") return groupByWeek(dailyBreakdown)
    if (profitGranularity === "month") return groupByMonth(dailyBreakdown)
    return dailyBreakdown
  }, [dailyBreakdown, profitGranularity])

  // ── Tab 5: Low stock ──────────────────────────────────────────────────────
  const lowStockProducts = useMemo(
    () => products.filter(p => p.stock <= p.lowStockAlert).sort((a, b) => a.stock - b.stock),
    [products]
  )

  return (
    <div className="space-y-5">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-[#1e3a5f]">Reportes</h1>
        <p className="text-gray-500 text-sm mt-0.5">Análisis de ventas, merma e inventario</p>
      </div>

      {/* Global filter bar */}
      <div className="bg-white border border-gray-100 rounded-xl p-4 shadow-sm">
        <div className="flex items-center gap-2 mb-3">
          <Filter className="h-4 w-4 text-gray-400" />
          <span className="text-sm font-medium text-gray-600">Filtros generales</span>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div>
            <label className="text-xs text-gray-400 mb-1 block flex items-center gap-1"><Calendar className="h-3 w-3" /> Desde</label>
            <Input type="date" value={filters.from} onChange={e => setFilters(f => ({ ...f, from: e.target.value }))} className="h-9 text-sm" />
          </div>
          <div>
            <label className="text-xs text-gray-400 mb-1 block flex items-center gap-1"><Calendar className="h-3 w-3" /> Hasta</label>
            <Input type="date" value={filters.to} onChange={e => setFilters(f => ({ ...f, to: e.target.value }))} className="h-9 text-sm" />
          </div>
          <div>
            <label className="text-xs text-gray-400 mb-1 block flex items-center gap-1"><Users className="h-3 w-3" /> Trabajador</label>
            <Select value={filters.workerId || "all"} onValueChange={v => setFilters(f => ({ ...f, workerId: v === "all" ? "" : v }))}>
              <SelectTrigger className="h-9 text-sm"><SelectValue placeholder="Todos" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                {workers.map(w => <SelectItem key={w.id} value={w.id}>{w.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="text-xs text-gray-400 mb-1 block flex items-center gap-1"><Building2 className="h-3 w-3" /> Empresa</label>
            <Select value={filters.companyId || "all"} onValueChange={v => setFilters(f => ({ ...f, companyId: v === "all" ? "" : v }))}>
              <SelectTrigger className="h-9 text-sm"><SelectValue placeholder="Todas" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas</SelectItem>
                {companies.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      {/* KPI summary */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: "Ventas Totales", value: formatCurrency(totalRevenue), icon: TrendingUp, color: "text-emerald-600", bg: "bg-emerald-50" },
          { label: "Ganancia Neta", value: formatCurrency(totalProfit), icon: BarChart3, color: "text-[#1e3a5f]", bg: "bg-blue-50" },
          { label: "Merma Total", value: `${totalMerma} und.`, icon: AlertTriangle, color: "text-orange-500", bg: "bg-orange-50" },
        ].map(({ label, value, icon: Icon, color, bg }) => (
          <div key={label} className="bg-white border border-gray-100 rounded-xl p-4 shadow-sm">
            <div className="flex items-center gap-2 mb-2">
              <div className={`w-7 h-7 rounded-lg ${bg} flex items-center justify-center`}>
                <Icon className={`h-3.5 w-3.5 ${color}`} />
              </div>
              <span className="text-xs text-gray-400 uppercase tracking-wide font-medium">{label}</span>
            </div>
            <p className="text-xl font-bold text-gray-900">{value}</p>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="bg-white border border-gray-100 rounded-2xl shadow-sm overflow-hidden">
        {/* Tab nav */}
        <div className="flex border-b border-gray-100 overflow-x-auto">
          {TABS.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => setActiveTab(id)}
              className={`flex items-center gap-2 px-5 py-3.5 text-sm font-medium whitespace-nowrap transition-colors border-b-2 flex-shrink-0 ${
                activeTab === id
                  ? "border-[#f97316] text-[#f97316] bg-orange-50/40"
                  : "border-transparent text-gray-500 hover:text-gray-700 hover:bg-gray-50"
              }`}
            >
              <Icon className="h-4 w-4" />
              {label}
            </button>
          ))}
        </div>

        <div className="p-5">
          {isLoading ? (
            <div className="flex items-center justify-center py-16">
              <div className="w-6 h-6 border-2 border-[#f97316] border-t-transparent rounded-full animate-spin" />
            </div>
          ) : (
            <>
              {/* ── TAB 1: Por Trabajador ──────────────────────────────── */}
              {activeTab === "workers" && (
                <div>
                  <h2 className="text-sm font-semibold text-gray-700 mb-4">Rendimiento por trabajador en el período</h2>
                  {workerStats.length === 0 ? (
                    <EmptyState icon={Users} text="Sin datos de trabajadores en el período" />
                  ) : (
                    <div className="border border-gray-100 rounded-xl overflow-hidden">
                      <Table>
                        <TableHeader>
                          <TableRow className="bg-gray-50">
                            <TableHead className="text-xs">Trabajador</TableHead>
                            <TableHead className="text-right text-xs">Días</TableHead>
                            <TableHead className="text-right text-xs">Und. vendidas</TableHead>
                            <TableHead className="text-right text-xs">Ventas</TableHead>
                            <TableHead className="text-right text-xs">Comisión</TableHead>
                            <TableHead className="text-right text-xs">Ganancia gen.</TableHead>
                            <TableHead className="text-right text-xs">Merma</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {workerStats.map(w => (
                            <TableRow key={w.id}>
                              <TableCell>
                                <div className="flex items-center gap-2">
                                  <div className="w-8 h-8 rounded-full bg-[#1e3a5f] flex items-center justify-center flex-shrink-0">
                                    <span className="text-white text-xs font-bold">
                                      {w.name.split(" ").map((n: string) => n[0]).join("").slice(0, 2).toUpperCase()}
                                    </span>
                                  </div>
                                  <div>
                                    <p className="font-medium text-sm">{w.name}</p>
                                    <p className="text-xs text-gray-400">
                                      {w.commissionType === "PERCENTAGE"
                                        ? `${w.commission}% ventas`
                                        : `S/ ${w.commission}/día`}
                                    </p>
                                  </div>
                                </div>
                              </TableCell>
                              <TableCell className="text-right text-sm">{w.daysWorked}</TableCell>
                              <TableCell className="text-right text-sm">{w.sold}</TableCell>
                              <TableCell className="text-right text-sm font-semibold">{formatCurrency(w.revenue)}</TableCell>
                              <TableCell className="text-right text-sm text-orange-600">{formatCurrency(w.commission)}</TableCell>
                              <TableCell className="text-right text-sm font-semibold text-emerald-700">{formatCurrency(w.profit)}</TableCell>
                              <TableCell className="text-right">
                                {w.merma > 0
                                  ? <Badge variant="destructive" className="text-xs">{w.merma}</Badge>
                                  : <span className="text-gray-300 text-sm">—</span>}
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  )}
                </div>
              )}

              {/* ── TAB 2: Inventario ─────────────────────────────────── */}
              {activeTab === "inventory" && (
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <h2 className="text-sm font-semibold text-gray-700">Stock actual por producto</h2>
                    <Select
                      value={filters.companyId || "all"}
                      onValueChange={v => setFilters(f => ({ ...f, companyId: v === "all" ? "" : v }))}
                    >
                      <SelectTrigger className="h-8 text-xs w-48"><SelectValue placeholder="Filtrar empresa" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Todas las empresas</SelectItem>
                        {companies.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="border border-gray-100 rounded-xl overflow-hidden">
                    <Table>
                      <TableHeader>
                        <TableRow className="bg-gray-50">
                          <TableHead className="text-xs">Producto</TableHead>
                          <TableHead className="text-xs">Empresa</TableHead>
                          <TableHead className="text-right text-xs">Stock (und.)</TableHead>
                          <TableHead className="text-right text-xs">Stock (cajas)</TableHead>
                          <TableHead className="text-right text-xs">Umbral</TableHead>
                          <TableHead className="text-right text-xs">Estado</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {products
                          .filter(p => !filters.companyId || p.companyId === filters.companyId)
                          .map(p => {
                            const low = p.stock <= p.lowStockAlert
                            return (
                              <TableRow key={p.id} className={low ? "bg-red-50/30" : ""}>
                                <TableCell className="font-medium text-sm">{p.name}</TableCell>
                                <TableCell className="text-sm text-gray-500">{p.company.name}</TableCell>
                                <TableCell className="text-right text-sm">{p.stock}</TableCell>
                                <TableCell className="text-right text-sm text-gray-500">
                                  {formatUnitsToBoxes(p.stock, p.unitPerBox)}
                                </TableCell>
                                <TableCell className="text-right text-sm text-gray-400">{p.lowStockAlert}</TableCell>
                                <TableCell className="text-right">
                                  <Badge variant={low ? "destructive" : "secondary"} className="text-xs">
                                    {low ? "Stock bajo" : "Normal"}
                                  </Badge>
                                </TableCell>
                              </TableRow>
                            )
                          })}
                      </TableBody>
                    </Table>
                  </div>
                </div>
              )}

              {/* ── TAB 3: Merma ──────────────────────────────────────── */}
              {activeTab === "merma" && (
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <h2 className="text-sm font-semibold text-gray-700">Merma registrada en el período</h2>
                    <div className="bg-red-50 border border-red-100 rounded-lg px-3 py-2 text-right">
                      <p className="text-xs text-red-500 font-medium uppercase tracking-wide">Pérdida total</p>
                      <p className="text-lg font-bold text-red-700">{formatCurrency(totalMermaCost)}</p>
                    </div>
                  </div>
                  {mermaStats.length === 0 ? (
                    <EmptyState icon={AlertTriangle} text="Sin merma registrada en el período" />
                  ) : (
                    <div className="border border-gray-100 rounded-xl overflow-hidden">
                      <Table>
                        <TableHeader>
                          <TableRow className="bg-gray-50">
                            <TableHead className="text-xs">Producto</TableHead>
                            <TableHead className="text-xs">Empresa</TableHead>
                            <TableHead className="text-right text-xs">Und. merma</TableHead>
                            <TableHead className="text-right text-xs">Costo unit.</TableHead>
                            <TableHead className="text-right text-xs">Pérdida S/</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {mermaStats.map((m, i) => (
                            <TableRow key={m.productId}>
                              <TableCell className="font-medium text-sm">{m.productName}</TableCell>
                              <TableCell className="text-sm text-gray-500">{m.companyName}</TableCell>
                              <TableCell className="text-right">
                                <Badge variant="destructive" className="text-xs">{m.units}</Badge>
                              </TableCell>
                              <TableCell className="text-right text-sm text-gray-500">{formatCurrency(m.costPrice)}</TableCell>
                              <TableCell className="text-right text-sm font-semibold text-red-700">{formatCurrency(m.units * m.costPrice)}</TableCell>
                            </TableRow>
                          ))}
                          <TableRow className="bg-red-50/40 font-semibold">
                            <TableCell colSpan={4} className="text-sm text-right text-red-700">Total pérdida por merma</TableCell>
                            <TableCell className="text-right text-red-700 font-bold">{formatCurrency(totalMermaCost)}</TableCell>
                          </TableRow>
                        </TableBody>
                      </Table>
                    </div>
                  )}
                </div>
              )}

              {/* ── TAB 4: Ganancias ──────────────────────────────────── */}
              {activeTab === "profits" && (
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <h2 className="text-sm font-semibold text-gray-700">Evolución de ganancias</h2>
                    <div className="flex gap-1 bg-gray-100 rounded-lg p-1">
                      {(["day", "week", "month"] as const).map((g) => (
                        <button
                          key={g}
                          onClick={() => setProfitGranularity(g)}
                          className={`text-xs px-3 py-1.5 rounded-md font-medium transition-colors ${
                            profitGranularity === g
                              ? "bg-white text-[#1e3a5f] shadow-sm"
                              : "text-gray-500 hover:text-gray-700"
                          }`}
                        >
                          {g === "day" ? "Día" : g === "week" ? "Semana" : "Mes"}
                        </button>
                      ))}
                    </div>
                  </div>

                  {chartData.length === 0 ? (
                    <EmptyState icon={TrendingUp} text="Sin datos de ganancias en el período" />
                  ) : (
                    <div className="h-72">
                      <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={chartData} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                          <XAxis
                            dataKey="date"
                            tick={{ fontSize: 11, fill: "#9ca3af" }}
                            tickFormatter={(v) => {
                              const d = new Date(v)
                              if (profitGranularity === "month") return d.toLocaleDateString("es-PE", { month: "short", year: "2-digit" })
                              return d.toLocaleDateString("es-PE", { day: "numeric", month: "short" })
                            }}
                          />
                          <YAxis tick={{ fontSize: 11, fill: "#9ca3af" }} tickFormatter={(v) => `S/${v.toFixed(0)}`} />
                          <RechartsTooltip content={<CustomTooltip />} />
                          <Line
                            type="monotone"
                            dataKey="profit"
                            name="Ganancia"
                            stroke="#1e3a5f"
                            strokeWidth={2.5}
                            dot={{ fill: "#1e3a5f", r: 4 }}
                            activeDot={{ r: 6 }}
                          />
                          <Line
                            type="monotone"
                            dataKey="revenue"
                            name="Ventas"
                            stroke="#f97316"
                            strokeWidth={2}
                            strokeDasharray="5 3"
                            dot={false}
                          />
                        </LineChart>
                      </ResponsiveContainer>
                    </div>
                  )}

                  {/* Summary grid */}
                  <div className="grid grid-cols-2 gap-3 mt-5">
                    <div className="bg-[#1e3a5f]/5 border border-[#1e3a5f]/10 rounded-xl p-4">
                      <p className="text-xs text-[#1e3a5f]/70 uppercase tracking-wide font-medium mb-1">Ganancia total</p>
                      <p className="text-2xl font-bold text-[#1e3a5f]">{formatCurrency(totalProfit)}</p>
                      <p className="text-xs text-gray-400 mt-1">en el período seleccionado</p>
                    </div>
                    <div className="bg-orange-50 border border-orange-100 rounded-xl p-4">
                      <p className="text-xs text-orange-600/70 uppercase tracking-wide font-medium mb-1">Ventas totales</p>
                      <p className="text-2xl font-bold text-orange-700">{formatCurrency(totalRevenue)}</p>
                      <p className="text-xs text-gray-400 mt-1">
                        margen: {totalRevenue > 0 ? ((totalProfit / totalRevenue) * 100).toFixed(1) : 0}%
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* ── TAB 5: Stock Bajo ──────────────────────────────────── */}
              {activeTab === "lowstock" && (
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <h2 className="text-sm font-semibold text-gray-700">Productos por debajo del umbral</h2>
                    <Badge variant="destructive" className="text-xs">{lowStockProducts.length} producto{lowStockProducts.length !== 1 ? "s" : ""}</Badge>
                  </div>
                  {lowStockProducts.length === 0 ? (
                    <div className="flex flex-col items-center py-12 text-center">
                      <div className="w-14 h-14 rounded-full bg-emerald-50 flex items-center justify-center mb-3">
                        <Package className="h-7 w-7 text-emerald-500" />
                      </div>
                      <p className="font-medium text-gray-700">Stock en niveles normales</p>
                      <p className="text-sm text-gray-400 mt-1">Todos los productos superan su umbral mínimo</p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {lowStockProducts.map((p) => {
                        const pct = Math.round((p.stock / p.lowStockAlert) * 100)
                        return (
                          <div key={p.id} className="flex items-center gap-4 bg-white border border-red-100 rounded-xl p-4 shadow-sm">
                            <div className="w-10 h-10 rounded-xl bg-red-50 flex items-center justify-center flex-shrink-0">
                              <AlertTriangle className="h-5 w-5 text-red-500" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center justify-between mb-1">
                                <p className="font-semibold text-sm text-gray-900 truncate">{p.name}</p>
                                <span className="text-xs text-gray-400 ml-2 flex-shrink-0">{p.company.name}</span>
                              </div>
                              <div className="flex items-center gap-3">
                                <div className="flex-1 bg-gray-100 rounded-full h-1.5">
                                  <div
                                    className="bg-red-500 h-1.5 rounded-full transition-all"
                                    style={{ width: `${Math.min(100, pct)}%` }}
                                  />
                                </div>
                                <span className="text-xs text-red-600 font-semibold flex-shrink-0">
                                  {p.stock} / {p.lowStockAlert} und.
                                </span>
                              </div>
                            </div>
                            <Button
                              size="sm"
                              variant="outline"
                              className="text-xs h-8 flex-shrink-0 border-[#1e3a5f]/30 text-[#1e3a5f] hover:bg-[#1e3a5f] hover:text-white"
                              onClick={() => router.push("/stock")}
                            >
                              Ingresar <ArrowRight className="h-3 w-3 ml-1" />
                            </Button>
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}

function EmptyState({ icon: Icon, text }: { icon: any; text: string }) {
  return (
    <div className="flex flex-col items-center py-12 text-center">
      <div className="w-14 h-14 rounded-full bg-gray-50 flex items-center justify-center mb-3">
        <Icon className="h-7 w-7 text-gray-300" />
      </div>
      <p className="text-gray-400 font-medium">{text}</p>
    </div>
  )
}
