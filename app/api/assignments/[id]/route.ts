import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { auth } from "@/lib/auth"

export async function DELETE(_: Request, { params }: { params: { id: string } }) {
  const session = await auth()
  if (!session || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 })
  }

  const assignment = await prisma.assignment.findUnique({
    where: { id: params.id },
    include: { dailySales: true, product: true },
  })
  if (!assignment) return NextResponse.json({ error: "No encontrado" }, { status: 404 })

  const totalSold = assignment.dailySales.reduce((sum, d) => sum + d.quantitySold, 0)
  const totalMerma = assignment.dailySales.reduce((sum, d) => sum + d.quantityMerma, 0)
  const remaining = Math.max(0, assignment.quantityAssigned - totalSold - totalMerma)

  await prisma.$transaction(async (tx: any) => {
    if (remaining > 0) {
      await tx.product.update({
        where: { id: assignment.productId },
        data: { stock: { increment: remaining } },
      })
    }
    await tx.assignment.delete({ where: { id: params.id } })
  })

  return NextResponse.json({ ok: true, stockRestored: remaining, productName: assignment.product.name })
}
