import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { auth } from "@/lib/auth"
import { z } from "zod"

const schema = z.object({
  productId: z.string().min(1),
  quantity: z.number().int().positive(),
  boxes: z.number().int().min(0).optional(),
  notes: z.string().optional(),
})

export async function GET() {
  const session = await auth()
  if (!session || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 })
  }
  const entries = await prisma.stockEntry.findMany({
    include: { product: { include: { company: true } } },
    orderBy: { entryDate: "desc" },
    take: 50,
  })
  return NextResponse.json(entries)
}

export async function POST(req: Request) {
  const session = await auth()
  if (!session || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 })
  }
  const body = await req.json()
  const parsed = schema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })

  const entry = await prisma.$transaction(async (tx: any) => {
    const created = await tx.stockEntry.create({ data: parsed.data })
    await tx.product.update({
      where: { id: parsed.data.productId },
      data: { stock: { increment: parsed.data.quantity } },
    })
    return created
  })
  return NextResponse.json(entry, { status: 201 })
}
