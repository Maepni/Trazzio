import { PrismaClient } from "@prisma/client"
import bcrypt from "bcryptjs"

const prisma = new PrismaClient()

async function main() {
  console.log("🗑️  Limpiando base de datos...")

  await prisma.workerPayment.deleteMany()
  await prisma.dailySale.deleteMany()
  await prisma.assignment.deleteMany()
  await prisma.stockEntry.deleteMany()
  await prisma.batch.deleteMany()
  await prisma.worker.deleteMany()
  await prisma.product.deleteMany()
  await prisma.company.deleteMany()
  await prisma.user.deleteMany()

  console.log("✅ Base de datos limpia")

  const hash = await bcrypt.hash("admin123", 10)
  await prisma.user.create({
    data: { username: "admin", password: hash, role: "ADMIN" },
  })

  console.log("✅ Admin creado: admin / admin123")
}

main()
  .catch((e) => { console.error(e); process.exit(1) })
  .finally(async () => { await prisma.$disconnect() })
