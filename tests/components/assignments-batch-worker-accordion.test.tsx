import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { vi } from "vitest"

vi.mock("@tanstack/react-query", async () => {
  const actual = await vi.importActual<typeof import("@tanstack/react-query")>("@tanstack/react-query")
  return {
    ...actual,
    useQuery: ({ initialData }: { initialData: any }) => ({ data: initialData }),
    useMutation: () => ({ mutate: vi.fn(), isPending: false }),
    useQueryClient: () => ({ invalidateQueries: vi.fn() }),
  }
})

vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }))

import { AssignmentsClient } from "@/components/admin/assignments-client"

const mockWorkers = [
  { id: "w1", name: "Juan Pérez", commission: 10, commissionType: "PERCENTAGE" },
]

const mockProducts = [
  {
    id: "p1",
    name: "Leche Gloria",
    company: { id: "c1", name: "Gloria" },
    stock: 50,
    unitPerBox: 12,
    salePrice: 2.5,
    costPrice: 2.0,
    productType: "ESTANDAR",
    lowStockAlert: 5,
  },
]

// Asignación activa de Juan en el lote más reciente
const mockAssignments = [
  {
    id: "a1",
    workerId: "w1",
    productId: "p1",
    startDate: "2026-02-26T08:00:00Z",
    quantityAssigned: 24,
    status: "ACTIVE",
    remaining: 24,
    totalSold: 0,
    totalMerma: 0,
    totalDue: 0,
    totalPaid: 0,
    pendingDebt: 0,
    worker: { id: "w1", name: "Juan Pérez" },
    product: {
      id: "p1",
      name: "Leche Gloria",
      company: { id: "c1", name: "Gloria" },
      unitPerBox: 12,
      salePrice: 2.5,
      productType: "ESTANDAR",
    },
  },
]

test("renderiza acordeón por lote con botón colapsable", async () => {
  render(
    <AssignmentsClient
      initialWorkers={mockWorkers}
      initialProducts={mockProducts}
      initialAssignments={mockAssignments}
    />
  )

  // Debe haber un botón con el label del lote (Lote #1)
  expect(screen.getByRole("button", { name: /Lote #1/i })).toBeInTheDocument()
})

test("al expandir lote aparece el trabajador", async () => {
  const user = userEvent.setup()
  render(
    <AssignmentsClient
      initialWorkers={mockWorkers}
      initialProducts={mockProducts}
      initialAssignments={mockAssignments}
    />
  )

  // Por defecto el lote está colapsado → al click aparece el trabajador
  const loteBtn = screen.getByRole("button", { name: /Lote #1/i })
  await user.click(loteBtn)

  expect(screen.getByText(/Juan Pérez/i)).toBeInTheDocument()
})

test("muestra badge auditStatus AUDITED en la fila del trabajador tras expandir lote", async () => {
  const user = userEvent.setup()
  const assignmentsWithAudit = [
    { ...mockAssignments[0], auditStatus: "AUDITED" },
  ]
  render(
    <AssignmentsClient
      initialWorkers={mockWorkers}
      initialProducts={mockProducts}
      initialAssignments={assignmentsWithAudit}
    />
  )
  // Expandir el lote para ver la fila del trabajador
  await user.click(screen.getByRole("button", { name: /Lote #1/i }))
  // El badge de auditStatus debe ser visible en la fila del trabajador
  expect(screen.getByText(/auditado/i)).toBeInTheDocument()
})

test("al expandir trabajador dentro del lote aparece el producto asignado", async () => {
  const user = userEvent.setup()
  render(
    <AssignmentsClient
      initialWorkers={mockWorkers}
      initialProducts={mockProducts}
      initialAssignments={mockAssignments}
    />
  )

  // Expandir lote
  await user.click(screen.getByRole("button", { name: /Lote #1/i }))

  // Expandir trabajador
  await user.click(screen.getByRole("button", { name: /Juan Pérez/i }))

  // El producto asignado debe estar visible
  expect(screen.getByText("Leche Gloria")).toBeInTheDocument()
})
