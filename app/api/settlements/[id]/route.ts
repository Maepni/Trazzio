import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { auth } from "@/lib/auth"
import { z } from "zod"

const patchSchema = z.object({
  amountPaid: z.number().min(0),
  adjustmentNote: z.string().optional(),
})

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const session = await auth()
  if (!session || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 })
  }

  const body = await req.json()
  const parsed = patchSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })

  const { amountPaid, adjustmentNote } = parsed.data
  const existing = await prisma.settlement.findUnique({ where: { id: params.id } })
  if (!existing) return NextResponse.json({ error: "No encontrada" }, { status: 404 })

  const difference = Number(existing.amountDue) - amountPaid
  const notes = adjustmentNote
    ? `${existing.notes ? existing.notes + " | " : ""}[Admin] ${adjustmentNote}`
    : existing.notes

  const updated = await prisma.settlement.update({
    where: { id: params.id },
    data: { amountPaid, difference, notes },
    include: { assignment: { include: { worker: true, product: { include: { company: true } }, mermaItems: true } } },
  })

  return NextResponse.json(updated)
}
