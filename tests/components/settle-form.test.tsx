import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { vi } from "vitest"

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
}))

import { SettleForm } from "@/components/worker/settle-form"

const mockAssignment = {
  id: "a1",
  product: {
    name: "Leche Gloria",
    company: { name: "Gloria" },
    salePrice: 2.5,
    unitPerBox: 12,
    productType: "ESTANDAR",
  },
  remaining: 24,
  pendingDebt: 0,
  quantityAssigned: 24,
  totalSold: 0,
  totalMerma: 0,
}

// Fixtures para lote activo (unitPerBox=1 → Stepper simple → fácil de manipular en tests)
const assignmentOld = {
  id: "old",
  startDate: "2026-02-20T08:00:00Z",
  product: {
    name: "Producto Viejo",
    company: { name: "Empresa A" },
    salePrice: 2.0,
    unitPerBox: 1,
    productType: "ESTANDAR",
  },
  remaining: 5,
  pendingDebt: 0,
  quantityAssigned: 5,
  totalSold: 0,
  totalMerma: 0,
}

const assignmentNew = {
  id: "new",
  startDate: "2026-02-26T08:00:00Z",
  product: {
    name: "Producto Nuevo",
    company: { name: "Empresa B" },
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

test("shows assigned initial and finalize button", () => {
  render(<SettleForm assignments={[mockAssignment]} />)
  expect(screen.getByText(/asignado:/i)).toBeInTheDocument()
  expect(screen.getByRole("button", { name: /finalizar registro del día/i })).toBeInTheDocument()
})

test("shows product name and company", () => {
  render(<SettleForm assignments={[mockAssignment]} />)
  expect(screen.getByText("Leche Gloria")).toBeInTheDocument()
  expect(screen.getByText(/restante/i)).toBeInTheDocument()
})

test("muestra solo las asignaciones del lote activo (startDate más reciente)", () => {
  render(<SettleForm assignments={[assignmentOld, assignmentNew]} />)
  expect(screen.queryByText(/Producto Viejo/i)).not.toBeInTheDocument()
  expect(screen.getByText(/Producto Nuevo/i)).toBeInTheDocument()
})

test("muestra error visible en DOM (role=alert) al confirmar sin movimiento", async () => {
  const user = userEvent.setup()
  render(<SettleForm assignments={[mockAssignment]} />)
  // Click sin ingresar ningún movimiento
  await user.click(screen.getByRole("button", { name: /finalizar registro del día/i }))
  // Debe haber un mensaje de error visible (no solo toast)
  expect(screen.getByRole("alert")).toBeInTheDocument()
})

test("calcula restante en tiempo real al cambiar vendido y merma", async () => {
  const user = userEvent.setup()
  render(<SettleForm assignments={[assignmentNew]} />)

  // Restante inicial = remaining = 10
  expect(screen.getByText(/Restante: 10u/i)).toBeInTheDocument()

  // Los spinbuttons del Stepper son: [Vendido spinbutton, Merma spinbutton]
  const [vendidoInput, mermaInput] = screen.getAllByRole("spinbutton")

  await user.clear(vendidoInput)
  await user.type(vendidoInput, "2")

  await user.clear(mermaInput)
  await user.type(mermaInput, "1")

  // Restante en tiempo real: 10 - 2 - 1 = 7
  expect(screen.getByText(/Restante: 7u/i)).toBeInTheDocument()
})
