// app/api/payments/route.ts
import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { auth } from "@/lib/auth"
import { z } from "zod"

export const dynamic = 'force-dynamic'

const schema = z.object({
  workerId: z.string().min(1),
  amount: z.preprocess((v) => Number(v), z.number().positive("El monto debe ser positivo")),
  notes: z.string().optional(),
})

export async function GET(req: Request) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const workerId = searchParams.get("workerId")

  if (session.user.role === "WORKER") {
    if (!session.user.workerId) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 })
    }
    const balance = await getWorkerBalance(session.user.workerId)
    return NextResponse.json(balance)
  }

  // ADMIN
  if (workerId) {
    const balance = await getWorkerBalance(workerId)
    return NextResponse.json(balance)
  }

  const workers = await prisma.worker.findMany({
    include: {
      payments: { orderBy: { paidAt: "desc" } },
      assignments: {
        where: { status: "SETTLED" },
        include: { settlement: true },
      },
    },
    orderBy: { name: "asc" },
  })

  const result = workers.map((w) => computeBalance(w))
  return NextResponse.json(result)
}

export async function POST(req: Request) {
  const session = await auth()
  if (!session || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 })
  }

  const body = await req.json()
  const parsed = schema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  }

  const { workerId, amount, notes } = parsed.data

  const worker = await prisma.worker.findUnique({ where: { id: workerId } })
  if (!worker) return NextResponse.json({ error: "Trabajador no encontrado" }, { status: 404 })

  const payment = await prisma.workerPayment.create({
    data: { workerId, amount, notes },
  })

  return NextResponse.json(payment, { status: 201 })
}

async function getWorkerBalance(workerId: string) {
  const worker = await prisma.worker.findUnique({
    where: { id: workerId },
    include: {
      payments: { orderBy: { paidAt: "desc" } },
      assignments: {
        where: { status: "SETTLED" },
        include: { settlement: true },
      },
    },
  })
  if (!worker) return null
  return computeBalance(worker)
}

function computeBalance(worker: any) {
  const totalEarned = worker.assignments.reduce((acc: number, a: any) => {
    if (!a.settlement) return acc
    const amountDue = Number(a.settlement.amountDue)
    if (worker.commissionType === "PERCENTAGE") {
      return acc + amountDue * (Number(worker.commission) / 100)
    } else {
      return acc + (a.quantitySold ?? 0) * Number(worker.commission)
    }
  }, 0)

  const totalPaid = worker.payments.reduce(
    (acc: number, p: any) => acc + Number(p.amount),
    0
  )

  return {
    workerId: worker.id,
    workerName: worker.name,
    commissionType: worker.commissionType,
    commission: Number(worker.commission),
    totalEarned: Math.round(totalEarned * 100) / 100,
    totalPaid: Math.round(totalPaid * 100) / 100,
    pendingBalance: Math.round((totalEarned - totalPaid) * 100) / 100,
    recentPayments: worker.payments.slice(0, 5),
  }
}
