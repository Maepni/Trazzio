import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { auth } from "@/lib/auth"

export async function DELETE(_: Request, { params }: { params: { id: string } }) {
  const session = await auth()
  if (!session || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 })
  }
  const assignment = await prisma.assignment.findUnique({ where: { id: params.id } })
  if (!assignment) return NextResponse.json({ error: "No encontrado" }, { status: 404 })
  if (assignment.status === "SETTLED") {
    return NextResponse.json({ error: "No se puede eliminar una asignación ya rendida" }, { status: 400 })
  }
  await prisma.$transaction(async (tx: any) => {
    await tx.product.update({ where: { id: assignment.productId }, data: { stock: { increment: assignment.quantityAssigned } } })
    await tx.assignment.delete({ where: { id: params.id } })
  })
  return NextResponse.json({ ok: true })
}
