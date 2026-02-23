import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { auth } from "@/lib/auth"
import { z } from "zod"
import { getTodayStart, getTodayEnd } from "@/lib/utils"

const itemSchema = z.object({
  productId: z.string().min(1),
  quantityAssigned: z.number().int().positive(),
  customSalePrice: z.preprocess(
    (v) => (v === "" || v === null || v === undefined ? null : Number(v)),
    z.number().positive().nullable().optional()
  ),
})
const schema = z.object({
  workerId: z.string().min(1),
  items: z.array(itemSchema).min(1),
})

export async function GET() {
  const session = await auth()
  if (!session || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 })
  }
  const start = getTodayStart()
  const end = getTodayEnd()
  const assignments = await prisma.assignment.findMany({
    where: { date: { gte: start, lte: end } },
    include: { worker: true, product: { include: { company: true } }, settlement: true },
    orderBy: { date: "desc" },
  })
  return NextResponse.json(assignments)
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
        await tx.product.update({ where: { id: item.productId }, data: { stock: { decrement: item.quantityAssigned } } })
        const assignment = await tx.assignment.create({
          data: { workerId, productId: item.productId, quantityAssigned: item.quantityAssigned, customSalePrice: item.customSalePrice ?? null },
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
