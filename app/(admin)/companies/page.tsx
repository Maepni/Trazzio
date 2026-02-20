import { prisma } from "@/lib/prisma"
import { CompaniesClient } from "@/components/admin/companies-client"
import { serialize } from "@/lib/utils"

export default async function CompaniesPage() {
  const companies = await prisma.company.findMany({
    include: {
      products: true,
      _count: { select: { products: true } },
    },
    orderBy: { name: "asc" },
  })

  return <CompaniesClient initialCompanies={serialize(companies)} />
}
