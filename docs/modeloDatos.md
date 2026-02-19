```prisma
// Empresa proveedora
model Company {
  id        String    @id @default(cuid())
  name      String
  products  Product[]
  createdAt DateTime  @default(now())
}

// Producto por empresa
model Product {
  id              String   @id @default(cuid())
  name            String
  companyId       String
  company         Company  @relation(fields: [companyId], references: [id])
  costPrice       Decimal  // precio de costo
  salePrice       Decimal  // precio de venta fijo (admin lo define)
  unitPerBox      Int      // unidades por caja
  lowStockAlert   Int      @default(10) // umbral de stock bajo (en unidades)
  stock           Int      @default(0) // stock actual en unidades
  createdAt       DateTime @default(now())
  
  assignments     Assignment[]
  mermaItems      MermaItem[]
}

// Trabajador
model Worker {
  id          String   @id @default(cuid())
  name        String
  phone       String?
  commission  Decimal  @default(0) // % o monto fijo de comisión
  userId      String   @unique
  user        User     @relation(fields: [userId], references: [id])
  createdAt   DateTime @default(now())
  
  assignments Assignment[]
}

// Lote asignado a un trabajador en un día
model Assignment {
  id          String   @id @default(cuid())
  workerId    String
  worker      Worker   @relation(fields: [workerId], references: [id])
  productId   String
  product     Product  @relation(fields: [productId], references: [id])
  date        DateTime @default(now())
  
  quantityAssigned Int   // unidades asignadas
  quantityReturned Int?  // unidades devueltas al rendir
  quantitySold     Int?  // calculado: assigned - returned - merma
  
  status      AssignmentStatus @default(PENDING) // PENDING | SETTLED
  
  mermaItems  MermaItem[]
  settlement  Settlement?
}

// Rendición del día
model Settlement {
  id           String     @id @default(cuid())
  assignmentId String     @unique
  assignment   Assignment @relation(fields: [assignmentId], references: [id])
  settledAt    DateTime   @default(now())
  
  totalSold    Int
  totalMerma   Int
  amountDue    Decimal    // totalSold * salePrice
  amountPaid   Decimal    // dinero entregado por el trabajador
  difference   Decimal    // amountDue - amountPaid (0 idealmente)
  notes        String?
}

// Merma (productos defectuosos, se devuelven a la empresa)
model MermaItem {
  id           String     @id @default(cuid())
  assignmentId String
  assignment   Assignment @relation(fields: [assignmentId], references: [id])
  productId    String
  product      Product    @relation(fields: [productId], references: [id])
  quantity     Int
  reason       String?    // descripción del defecto
  createdAt    DateTime   @default(now())
}

// Entrada de mercadería
model StockEntry {
  id        String   @id @default(cuid())
  productId String
  quantity  Int      // unidades ingresadas
  boxes     Int?     // cajas ingresadas (referencia)
  entryDate DateTime @default(now())
  notes     String?
}

// Auth
model User {
  id       String  @id @default(cuid())
  email    String  @unique
  password String
  role     Role    @default(WORKER)
  worker   Worker?
}

enum Role {
  ADMIN
  WORKER
}

enum AssignmentStatus {
  PENDING
  SETTLED
}