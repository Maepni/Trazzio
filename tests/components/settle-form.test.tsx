import { render, screen } from "@testing-library/react"
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
