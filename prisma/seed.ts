import { PrismaClient } from "@prisma/client"
import bcrypt from "bcryptjs"

const prisma = new PrismaClient()

async function main() {
  console.log("🌱 Iniciando seed...")

  // Admin
  const hashedAdmin = await bcrypt.hash("admin123", 10)
  const admin = await prisma.user.upsert({
    where: { email: "admin@trazzio.com" },
    update: {},
    create: { email: "admin@trazzio.com", password: hashedAdmin, role: "ADMIN" },
  })
  console.log("✅ Admin:", admin.email, "/ admin123")

  // Empresas
  const company1 = await prisma.company.upsert({
    where: { id: "company-demo-1" },
    update: {},
    create: { id: "company-demo-1", name: "Conservas del Sur S.A." },
  })
  const company2 = await prisma.company.upsert({
    where: { id: "company-demo-2" },
    update: {},
    create: { id: "company-demo-2", name: "Alimentos La Mar" },
  })
  console.log("✅ Empresas creadas")

  // Productos
  await prisma.product.upsert({
    where: { id: "product-demo-1" },
    update: {},
    create: {
      id: "product-demo-1",
      name: "Atún en agua x170g",
      companyId: company1.id,
      costPrice: 2.5,
      salePrice: 4.0,
      unitPerBox: 48,
      lowStockAlert: 50,
      stock: 200,
    },
  })
  await prisma.product.upsert({
    where: { id: "product-demo-2" },
    update: {},
    create: {
      id: "product-demo-2",
      name: "Sardinas en tomate x425g",
      companyId: company1.id,
      costPrice: 3.2,
      salePrice: 5.5,
      unitPerBox: 24,
      lowStockAlert: 30,
      stock: 120,
    },
  })
  await prisma.product.upsert({
    where: { id: "product-demo-3" },
    update: {},
    create: {
      id: "product-demo-3",
      name: "Jurel al natural x425g",
      companyId: company2.id,
      costPrice: 2.8,
      salePrice: 4.5,
      unitPerBox: 24,
      lowStockAlert: 25,
      stock: 80,
    },
  })
  console.log("✅ Productos creados")

  // Trabajador demo
  const workerPassword = await bcrypt.hash("worker123", 10)
  const workerUser = await prisma.user.upsert({
    where: { email: "trabajador@trazzio.com" },
    update: {},
    create: { email: "trabajador@trazzio.com", password: workerPassword, role: "WORKER" },
  })
  await prisma.worker.upsert({
    where: { userId: workerUser.id },
    update: {},
    create: {
      name: "Juan Pérez",
      phone: "987654321",
      commission: 5,
      commissionType: "PERCENTAGE",
      userId: workerUser.id,
    },
  })
  console.log("✅ Trabajador demo:", workerUser.email, "/ worker123")

  console.log("\n🎉 Seed completado!")
  console.log("   Admin:      admin@trazzio.com    / admin123")
  console.log("   Trabajador: trabajador@trazzio.com / worker123")
}

main()
  .catch((e) => { console.error(e); process.exit(1) })
  .finally(async () => { await prisma.$disconnect() })
