import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { auth } from "@/lib/auth"
import { z } from "zod"
import bcrypt from "bcryptjs"

const schema = z.object({
  name: z.string().min(1, "Nombre requerido"),
  phone: z.string().optional(),
  commission: z.number().min(0).default(0),
  commissionType: z.enum(["PERCENTAGE", "FIXED"]).default("PERCENTAGE"),
  username: z.string().min(3, "Mínimo 3 caracteres").regex(/^\S+$/, "Sin espacios"),
  password: z.string().min(6, "Mínimo 6 caracteres"),
})

export async function GET() {
  const session = await auth()
  if (!session || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 })
  }
  const workers = await prisma.worker.findMany({
    include: { user: { select: { username: true } }, _count: { select: { assignments: true } } },
    orderBy: { name: "asc" },
  })
  return NextResponse.json(workers)
}

export async function POST(req: Request) {
  const session = await auth()
  if (!session || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 })
  }
  const body = await req.json()
  const parsed = schema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })

  const { username, password, name, phone, commission, commissionType } = parsed.data
  const existing = await prisma.user.findUnique({ where: { username } })
  if (existing) return NextResponse.json({ error: "Usuario ya registrado" }, { status: 409 })

  const hashedPassword = await bcrypt.hash(password, 10)
  const worker = await prisma.$transaction(async (tx: any) => {
    const user = await tx.user.create({ data: { username, password: hashedPassword, role: "WORKER" } })
    return tx.worker.create({
      data: { name, phone, commission, commissionType, userId: user.id },
      include: { user: { select: { username: true } } },
    })
  })
  return NextResponse.json(worker, { status: 201 })
}
