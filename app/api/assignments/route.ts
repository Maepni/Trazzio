import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { auth } from "@/lib/auth"
import { z } from "zod"

const itemSchema = z.object({
  productId: z.string().min(1),
  quantityAssigned: z.number().int().positive(),
})
const schema = z.object({
  workerId: z.string().min(1),
  items: z.array(itemSchema).min(1),
})

export async function GET() {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 })

  const isAdmin = session.user.role === "ADMIN"
  const workerId = session.user.workerId

  const where = isAdmin
    ? { status: "ACTIVE" as const }
    : { status: "ACTIVE" as const, workerId: workerId ?? "" }

  const assignments = await prisma.assignment.findMany({
    where,
    include: {
      worker: true,
      product: { include: { company: true } },
      dailySales: { orderBy: { date: "asc" } },
    },
    orderBy: { startDate: "desc" },
  })

  const withTotals = assignments.map((a) => {
    const totalSold = a.dailySales.reduce((sum, d) => sum + d.quantitySold, 0)
    const totalMerma = a.dailySales.reduce((sum, d) => sum + d.quantityMerma, 0)
    const remaining = a.quantityAssigned - totalSold - totalMerma
    const totalDue = Number(a.product.salePrice) * totalSold
    const totalPaid = a.dailySales.reduce((sum, d) => sum + Number(d.amountPaid), 0)
    const pendingDebt = Math.max(0, totalDue - totalPaid)
    return { ...a, totalSold, totalMerma, remaining, totalDue, totalPaid, pendingDebt }
  })

  return NextResponse.json(withTotals)
}

export async function POST(req: Request) {
  const session = await auth()
  if (!session || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 })
  }
  const body = await req.json()
  const parsed = schema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })

  const { workerId, items } = parsed.data
  try {
    const assignments = await prisma.$transaction(async (tx: any) => {
      const created = []
      for (const item of items) {
        const product = await tx.product.findUnique({ where: { id: item.productId } })
        if (!product || product.stock < item.quantityAssigned) {
          throw new Error(`Stock insuficiente para: ${product?.name ?? item.productId}`)
        }
        await tx.product.update({
          where: { id: item.productId },
          data: { stock: { decrement: item.quantityAssigned } },
        })
        const assignment = await tx.assignment.create({
          data: { workerId, productId: item.productId, quantityAssigned: item.quantityAssigned },
          include: { worker: true, product: { include: { company: true } } },
        })
        created.push(assignment)
      }
      return created
    })
    return NextResponse.json(assignments, { status: 201 })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 400 })
  }
}
