import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { auth } from "@/lib/auth"
import { z } from "zod"
import bcrypt from "bcryptjs"

const schema = z.object({
  name: z.string().min(1).optional(),
  phone: z.string().optional(),
  commission: z.number().min(0).optional(),
  commissionType: z.enum(["PERCENTAGE", "FIXED"]).optional(),
  password: z.string().min(6).optional(),
})

export async function PUT(req: Request, { params }: { params: { id: string } }) {
  const session = await auth()
  if (!session || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 })
  }
  const body = await req.json()
  const parsed = schema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })

  const { password, ...workerData } = parsed.data
  const worker = await prisma.$transaction(async (tx: any) => {
    const updated = await tx.worker.update({ where: { id: params.id }, data: workerData, include: { user: true } })
    if (password) {
      await tx.user.update({ where: { id: updated.userId }, data: { password: await bcrypt.hash(password, 10) } })
    }
    return updated
  })
  return NextResponse.json(worker)
}

export async function DELETE(_: Request, { params }: { params: { id: string } }) {
  const session = await auth()
  if (!session || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 })
  }
  await prisma.worker.delete({ where: { id: params.id } })
  return NextResponse.json({ ok: true })
}
