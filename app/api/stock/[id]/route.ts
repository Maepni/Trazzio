import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { auth } from "@/lib/auth"

export async function DELETE(_: Request, { params }: { params: { id: string } }) {
  const session = await auth()
  if (!session || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 })
  }

  const entry = await prisma.stockEntry.findUnique({ where: { id: params.id } })
  if (!entry) return NextResponse.json({ error: "Entrada no encontrada" }, { status: 404 })

  await prisma.$transaction(async (tx: any) => {
    const product = await tx.product.findUnique({ where: { id: entry.productId } })
    if (!product) throw new Error("Producto no encontrado")

    const newStock = product.stock - entry.quantity
    if (newStock < 0) {
      throw new Error(`No se puede eliminar: el stock quedaría en ${newStock}`)
    }

    await tx.product.update({
      where: { id: entry.productId },
      data: { stock: { decrement: entry.quantity } },
    })
    await tx.stockEntry.delete({ where: { id: params.id } })
  })

  return NextResponse.json({ ok: true })
}
