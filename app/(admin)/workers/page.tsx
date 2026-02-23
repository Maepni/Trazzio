import { prisma } from "@/lib/prisma"
import { WorkersClient } from "@/components/admin/workers-client"
import { serialize } from "@/lib/utils"

export const dynamic = 'force-dynamic'

export default async function WorkersPage() {
  const workers = await prisma.worker.findMany({
    include: {
      user: { select: { email: true } },
      _count: { select: { assignments: true } },
    },
    orderBy: { name: "asc" },
  })

  return <WorkersClient initialWorkers={serialize(workers)} />
}
