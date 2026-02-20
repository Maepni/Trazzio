import { prisma } from "@/lib/prisma"
import { ReportsClient } from "@/components/admin/reports-client"
import { serialize } from "@/lib/utils"

export default async function ReportsPage() {
  const [workers, companies, products] = await Promise.all([
    prisma.worker.findMany({ orderBy: { name: "asc" } }),
    prisma.company.findMany({
      include: { products: true },
      orderBy: { name: "asc" },
    }),
    prisma.product.findMany({
      include: { company: true },
      orderBy: [{ company: { name: "asc" } }, { name: "asc" }],
    }),
  ])

  return (
    <ReportsClient
      workers={serialize(workers)}
      companies={serialize(companies)}
      products={serialize(products)}
    />
  )
}
