import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { auth } from "@/lib/auth"

export async function POST(req: Request) {
  const session = await auth()
  if (!session || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 })
  }

  const body = await req.json()
  const { workerId, batchId, batchDay } = body

  if (!workerId || (!batchId && !batchDay)) {
    return NextResponse.json({ error: "workerId y (batchId o batchDay) son requeridos" }, { status: 400 })
  }

  let assignments
  if (batchId) {
    // Buscar por workerId + batchId
    assignments = await prisma.assignment.findMany({
      where: { workerId, batchId, status: "ACTIVE" },
      include: { dailySales: true, product: true },
    })
  } else {
    // Fallback legacy: batchDay es "YYYY-MM-DD" en UTC
    const dayStart = new Date(batchDay + "T00:00:00.000Z")
    const dayEnd = new Date(batchDay + "T23:59:59.999Z")
    assignments = await prisma.assignment.findMany({
      where: {
        workerId,
        status: "ACTIVE",
        startDate: { gte: dayStart, lte: dayEnd },
      },
      include: { dailySales: true, product: true },
    })
  }

  if (assignments.length === 0) {
    return NextResponse.json({ error: "Sin asignaciones activas para auditar en este lote" }, { status: 404 })
  }

  const results = await prisma.$transaction(async (tx: any) => {
    const summaries = []
    for (const a of assignments) {
      const totalSold = a.dailySales.reduce((sum, d) => sum + d.quantitySold, 0)
      const totalMerma = a.dailySales.reduce((sum, d) => sum + d.quantityMerma, 0)
      const remaining = Math.max(0, a.quantityAssigned - totalSold - totalMerma)

      if (remaining > 0) {
        await tx.product.update({
          where: { id: a.productId },
          data: { stock: { increment: remaining } },
        })
      }

      await tx.assignment.update({
        where: { id: a.id },
        data: { status: "CLOSED", auditStatus: "AUDITED" },
      })

      summaries.push({
        productName: a.product.name,
        quantityAssigned: a.quantityAssigned,
        totalSold,
        totalMerma,
        remaining,
      })
    }
    return summaries
  })

  // Si se usó batchId, verificar si quedan asignaciones ACTIVE en el lote → cerrar batch
  if (batchId) {
    const remaining = await prisma.assignment.findFirst({
      where: { batchId, status: 'ACTIVE' },
    })
    if (!remaining) {
      await prisma.batch.update({
        where: { id: batchId },
        data: { status: 'CLOSED', closedAt: new Date() },
      })
    }
  }

  const totalRestored = results.reduce((sum, r) => sum + r.remaining, 0)
  return NextResponse.json({ ok: true, results, totalRestored })
}
