import { prisma } from "@/lib/prisma"
import { StockClient } from "@/components/admin/stock-client"
import { serialize } from "@/lib/utils"

export const dynamic = 'force-dynamic'

export default async function StockPage() {
  const [products, entries, batches] = await Promise.all([
    prisma.product.findMany({
      include: { company: true },
      orderBy: [{ company: { name: "asc" } }, { name: "asc" }],
    }),
    prisma.stockEntry.findMany({
      include: {
        product: { include: { company: true } },
        batch: { select: { id: true, code: true } },
      },
      orderBy: { entryDate: "desc" },
      take: 20,
    }),
    prisma.batch.findMany({ orderBy: { openedAt: 'asc' } }),
  ])

  const activeBatch = batches.find(b => b.status === 'OPEN') ?? null
  const activeBatchWithNumber = activeBatch
    ? { ...activeBatch, number: batches.indexOf(activeBatch) + 1 }
    : null

  return (
    <StockClient
      initialProducts={serialize(products)}
      initialEntries={serialize(entries)}
      activeBatch={serialize(activeBatchWithNumber)}
      totalBatches={batches.length}
    />
  )
}
