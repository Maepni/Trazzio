import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { vi } from "vitest"

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
}))

vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }))

import { SettleForm } from "@/components/worker/settle-form"

const assignment = {
  id: "a1",
  startDate: "2026-02-26T08:00:00Z",
  product: {
    name: "Producto Test",
    company: { name: "Empresa X" },
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

test("el botón CTA 'Finalizar registro del día' existe en el formulario (paso 1)", () => {
  render(<SettleForm assignments={[assignment]} />)
  expect(
    screen.getByRole("button", { name: /finalizar registro del día/i })
  ).toBeInTheDocument()
})

test("el botón de confirmación final queda disabled durante el envío", async () => {
  // Mock fetch que nunca resuelve (simula carga)
  const fetchMock = vi.fn(() => new Promise(() => {}))
  vi.stubGlobal("fetch", fetchMock)

  const user = userEvent.setup()
  render(<SettleForm assignments={[assignment]} />)

  // Agregar movimiento: vendido = 1 (para que activeItems no sea vacío)
  const [vendidoInput] = screen.getAllByRole("spinbutton")
  await user.clear(vendidoInput)
  await user.type(vendidoInput, "1")

  // Paso 1 → clic en "Finalizar registro del día" → va al paso 2 (confirmación)
  await user.click(screen.getByRole("button", { name: /finalizar registro del día/i }))

  // Ahora estamos en paso 2: el botón final es "Finalizar registro del día" (submit)
  const confirmBtn = screen.getByRole("button", { name: /finalizar registro del día/i })
  expect(confirmBtn).toBeInTheDocument()
  expect(confirmBtn).not.toBeDisabled()

  // Clic → fetch cuelga → botón queda disabled
  await user.click(confirmBtn)
  expect(confirmBtn).toBeDisabled()

  vi.unstubAllGlobals()
})
