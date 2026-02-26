import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { auth } from "@/lib/auth"
import { z } from "zod"

const itemSchema = z.object({
  assignmentId: z.string().min(1),
  quantitySold: z.number().int().min(0),
  quantityMerma: z.number().int().min(0).default(0),
  amountPaid: z.number().min(0).default(0),
  notes: z.string().optional(),
})
const schema = z.array(itemSchema).min(1)

// GET /api/daily-sales?assignmentId=xxx
export async function GET(req: Request) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const assignmentId = searchParams.get("assignmentId")
  if (!assignmentId) return NextResponse.json({ error: "assignmentId requerido" }, { status: 400 })

  // Verificar que el usuario tiene acceso a esta asignación
  const assignment = await prisma.assignment.findUnique({
    where: { id: assignmentId },
    include: { worker: true },
  })
  if (!assignment) return NextResponse.json({ error: "No encontrado" }, { status: 404 })

  const isAdmin = session.user.role === "ADMIN"
  const isOwner = assignment.workerId === session.user.workerId
  if (!isAdmin && !isOwner) {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 })
  }

  const sales = await prisma.dailySale.findMany({
    where: { assignmentId },
    orderBy: { date: "desc" },
  })
  return NextResponse.json(sales)
}

// POST /api/daily-sales — batch
export async function POST(req: Request) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 })

  const body = await req.json()
  const parsed = schema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })

  const items = parsed.data

  try {
    const created = await prisma.$transaction(async (tx: any) => {
      const results = []
      for (const item of items) {
        const assignment = await tx.assignment.findUnique({
          where: { id: item.assignmentId },
          include: { dailySales: true, product: true },
        })
        if (!assignment) throw new Error(`Asignación no encontrada: ${item.assignmentId}`)
        if (assignment.status !== "ACTIVE") {
          throw new Error(`La asignación de "${assignment.product.name}" ya está cerrada`)
        }

        // Verificar que el usuario es dueño (si es worker)
        if (session.user.role !== "ADMIN" && assignment.workerId !== session.user.workerId) {
          throw new Error("No autorizado para esta asignación")
        }

        // Calcular remaining actual
        const totalSold = assignment.dailySales.reduce((sum: number, d: any) => sum + d.quantitySold, 0)
        const totalMerma = assignment.dailySales.reduce((sum: number, d: any) => sum + d.quantityMerma, 0)
        const remaining = assignment.quantityAssigned - totalSold - totalMerma

        if (item.quantitySold + item.quantityMerma > remaining) {
          throw new Error(
            `"${assignment.product.name}": vendido (${item.quantitySold}) + merma (${item.quantityMerma}) supera el restante (${remaining})`
          )
        }

        const sale = await tx.dailySale.create({
          data: {
            assignmentId: item.assignmentId,
            quantitySold: item.quantitySold,
            quantityMerma: item.quantityMerma,
            amountPaid: item.amountPaid,
            notes: item.notes,
          },
        })
        results.push(sale)
      }
      return results
    })
    return NextResponse.json(created, { status: 201 })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 400 })
  }
}
