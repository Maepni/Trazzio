import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { auth } from "@/lib/auth"
import { z } from "zod"

const mermaSchema = z.object({
  productId: z.string(),
  quantity: z.number().int().min(0),
  reason: z.string().optional(),
})
const schema = z.object({
  assignmentId: z.string().min(1),
  quantityReturned: z.number().int().min(0),
  mermaItems: z.array(mermaSchema).default([]),
  amountPaid: z.number().min(0),
  notes: z.string().optional(),
})

export async function GET(req: Request) {
  const session = await auth()
  if (!session || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 })
  }
  const { searchParams } = new URL(req.url)
  const from = searchParams.get("from")
  const to = searchParams.get("to")
  const workerId = searchParams.get("workerId")

  const where: any = {}
  if (from || to) {
    where.settledAt = {
      ...(from && { gte: new Date(from) }),
      ...(to && { lte: new Date(to + "T23:59:59") }),
    }
  }

  const settlements = await prisma.settlement.findMany({
    where,
    include: { assignment: { include: { worker: true, product: { include: { company: true } }, mermaItems: { include: { product: true } } } } },
    orderBy: { settledAt: "desc" },
    take: 200,
  })

  const filtered = workerId ? settlements.filter((s: any) => s.assignment.workerId === workerId) : settlements
  return NextResponse.json(filtered)
}

export async function POST(req: Request) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 })

  const body = await req.json()
  const parsed = schema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })

  const { assignmentId, quantityReturned, mermaItems, amountPaid, notes } = parsed.data
  const assignment = await prisma.assignment.findUnique({ where: { id: assignmentId }, include: { product: true } })
  if (!assignment) return NextResponse.json({ error: "Asignación no encontrada" }, { status: 404 })
  if (assignment.status === "SETTLED") return NextResponse.json({ error: "Ya rendida" }, { status: 400 })

  const totalMerma = mermaItems.reduce((sum, m) => sum + m.quantity, 0)
  const totalSold = assignment.quantityAssigned - quantityReturned - totalMerma
  if (totalSold < 0) return NextResponse.json({ error: "Cantidades inválidas: sobrante + merma supera lo asignado" }, { status: 400 })

  const amountDue = totalSold * Number(assignment.product.salePrice)
  const difference = amountDue - amountPaid

  const settlement = await prisma.$transaction(async (tx: any) => {
    if (mermaItems.length > 0) {
      await tx.mermaItem.createMany({
        data: mermaItems.map((m) => ({ assignmentId, productId: m.productId, quantity: m.quantity, reason: m.reason })),
      })
    }
    await tx.assignment.update({ where: { id: assignmentId }, data: { status: "SETTLED", quantityReturned, quantitySold: totalSold } })
    return tx.settlement.create({
      data: { assignmentId, totalSold, totalMerma, amountDue, amountPaid, difference, notes },
      include: { assignment: { include: { worker: true, product: { include: { company: true } } } } },
    })
  })
  return NextResponse.json(settlement, { status: 201 })
}
