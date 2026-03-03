import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { vi } from "vitest"

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
}))

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

import { SettleForm } from "@/components/worker/settle-form"
import { BatchGroupCard } from "@/components/shared/batch-group-card"
import { AssignmentsClient } from "@/components/admin/assignments-client"

const assignment = {
  id: "a1",
  startDate: "2026-02-26T08:00:00Z",
  product: {
    name: "Leche Gloria",
    company: { name: "Gloria" },
    salePrice: 2.5,
    unitPerBox: 1,
    productType: "ESTANDAR",
  },
  remaining: 10,
  pendingDebt: 0,
  quantityAssigned: 10,
  totalSold: 0,
  totalMerma: 0,
}

// — SettleForm a11y —

test("SettleForm: label 'Vendido hoy' visible en el formulario", () => {
  render(<SettleForm assignments={[assignment]} />)
  // El label "Vendido hoy" debe estar visible (accesibilidad básica)
  expect(screen.getByText(/vendido hoy/i)).toBeInTheDocument()
})

test("SettleForm: label 'Merma hoy' visible en el formulario", () => {
  render(<SettleForm assignments={[assignment]} />)
  expect(screen.getByText(/merma hoy/i)).toBeInTheDocument()
})

test("SettleForm: inputs numéricos con tipo correcto (spinbutton)", () => {
  render(<SettleForm assignments={[assignment]} />)
  const spinbuttons = screen.getAllByRole("spinbutton")
  // unitPerBox=1 → 2 spinbuttons: vendido + merma
  expect(spinbuttons.length).toBeGreaterThanOrEqual(2)
})

// — BatchGroupCard a11y —

test("BatchGroupCard: botón colapsable tiene aria-expanded", () => {
  render(
    <BatchGroupCard label="Lote #1" date="26 feb" count={3}>
      <p>Contenido del lote</p>
    </BatchGroupCard>
  )
  const btn = screen.getByRole("button", { name: /Lote #1/i })
  expect(btn).toHaveAttribute("aria-expanded")
})

test("BatchGroupCard: aria-expanded cambia al colapsar", async () => {
  const user = userEvent.setup()
  render(
    <BatchGroupCard label="Lote #1" date="26 feb" count={3} defaultOpen={true}>
      <p>Contenido del lote</p>
    </BatchGroupCard>
  )
  const btn = screen.getByRole("button", { name: /Lote #1/i })
  expect(btn).toHaveAttribute("aria-expanded", "true")

  await user.click(btn)
  expect(btn).toHaveAttribute("aria-expanded", "false")
})

// — AssignmentsClient a11y —

const mockWorkers = [{ id: "w1", name: "Juan Pérez", commission: 10, commissionType: "PERCENTAGE" }]
const mockProducts = [{
  id: "p1", name: "Leche", company: { id: "c1", name: "Gloria" },
  stock: 50, unitPerBox: 12, salePrice: 2.5, costPrice: 2.0,
  productType: "ESTANDAR", lowStockAlert: 5,
}]
const mockAssignments = [{
  id: "a1", workerId: "w1", productId: "p1",
  startDate: "2026-02-26T08:00:00Z", quantityAssigned: 24, status: "ACTIVE",
  remaining: 24, totalSold: 0, totalMerma: 0, totalDue: 0, totalPaid: 0, pendingDebt: 0,
  worker: { id: "w1", name: "Juan Pérez" },
  product: { id: "p1", name: "Leche", company: { id: "c1", name: "Gloria" }, unitPerBox: 12, salePrice: 2.5, productType: "ESTANDAR" },
}]

test("AssignmentsClient: botón de lote tiene aria-expanded", () => {
  render(
    <AssignmentsClient
      initialWorkers={mockWorkers}
      initialProducts={mockProducts}
      initialAssignments={mockAssignments}
      activeBatch={{ id: "b1", code: "LOTE-0001", status: "OPEN", number: 1 }}
      totalBatches={1}
    />
  )
  const loteBtn = screen.getByRole("button", { name: /Lote #1/i })
  expect(loteBtn).toHaveAttribute("aria-expanded")
})
