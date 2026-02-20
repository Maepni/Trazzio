import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { auth } from "@/lib/auth"
import { z } from "zod"

const schema = z.object({
  name: z.string().min(1).optional(),
  costPrice: z.number().positive().optional(),
  salePrice: z.number().positive().optional(),
  unitPerBox: z.number().int().positive().optional(),
  lowStockAlert: z.number().int().min(0).optional(),
})

export async function PUT(req: Request, { params }: { params: { id: string } }) {
  const session = await auth()
  if (!session || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 })
  }
  const body = await req.json()
  const parsed = schema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  const product = await prisma.product.update({ where: { id: params.id }, data: parsed.data })
  return NextResponse.json(product)
}

export async function DELETE(_: Request, { params }: { params: { id: string } }) {
  const session = await auth()
  if (!session || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 })
  }
  await prisma.product.delete({ where: { id: params.id } })
  return NextResponse.json({ ok: true })
}
