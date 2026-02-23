import { prisma } from "@/lib/prisma"
import { StockClient } from "@/components/admin/stock-client"
import { serialize } from "@/lib/utils"

export const dynamic = 'force-dynamic'

export default async function StockPage() {
  const [products, entries] = await Promise.all([
    prisma.product.findMany({
      include: { company: true },
      orderBy: [{ company: { name: "asc" } }, { name: "asc" }],
    }),
    prisma.stockEntry.findMany({
      include: { product: { include: { company: true } } },
      orderBy: { entryDate: "desc" },
      take: 20,
    }),
  ])

  return <StockClient initialProducts={serialize(products)} initialEntries={serialize(entries)} />
}
