import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { auth } from "@/lib/auth"

export const dynamic = 'force-dynamic'

export async function GET() {
  const session = await auth()
  if (!session || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 })
  }

  const batches = await prisma.batch.findMany({ orderBy: { openedAt: 'asc' } })
  const activeBatch = batches.find(b => b.status === 'OPEN') ?? null
  const number = activeBatch ? batches.indexOf(activeBatch) + 1 : null

  const activeAssignments = await prisma.assignment.findFirst({ where: { status: 'ACTIVE' } })
  const canOpenNew = !activeAssignments

  return NextResponse.json({
    activeBatch: activeBatch ? { ...activeBatch, number } : null,
    canOpenNew,
    totalBatches: batches.length,
  })
}

export async function POST() {
  const session = await auth()
  if (!session || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 })
  }

  // Verificar que no haya asignaciones ACTIVE
  const activeAssignments = await prisma.assignment.findFirst({ where: { status: 'ACTIVE' } })
  if (activeAssignments) {
    return NextResponse.json(
      { error: "Hay asignaciones activas. Audita todos los trabajadores antes de abrir un nuevo lote." },
      { status: 400 }
    )
  }

  // Cerrar batch OPEN actual si existe
  const openBatch = await prisma.batch.findFirst({ where: { status: 'OPEN' } })
  if (openBatch) {
    await prisma.batch.update({
      where: { id: openBatch.id },
      data: { status: 'CLOSED', closedAt: new Date() },
    })
  }

  // Calcular número del nuevo lote
  const totalBatches = await prisma.batch.count()
  const newNumber = totalBatches + 1
  const code = `LOTE-${String(newNumber).padStart(4, '0')}`

  const newBatch = await prisma.batch.create({
    data: { code, status: 'OPEN' },
  })

  return NextResponse.json({ batch: newBatch, number: newNumber }, { status: 201 })
}
