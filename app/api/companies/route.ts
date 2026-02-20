import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { auth } from "@/lib/auth"
import { z } from "zod"

const schema = z.object({ name: z.string().min(1, "Nombre requerido") })

export async function GET() {
  const session = await auth()
  if (!session || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 })
  }
  const companies = await prisma.company.findMany({
    include: { products: true, _count: { select: { products: true } } },
    orderBy: { name: "asc" },
  })
  return NextResponse.json(companies)
}

export async function POST(req: Request) {
  const session = await auth()
  if (!session || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 })
  }
  const body = await req.json()
  const parsed = schema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  const company = await prisma.company.create({ data: { name: parsed.data.name } })
  return NextResponse.json(company, { status: 201 })
}
