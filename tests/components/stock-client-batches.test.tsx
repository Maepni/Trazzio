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

import { StockClient } from "@/components/admin/stock-client"

const mockProducts = [
  {
    id: "p1",
    name: "Leche Gloria",
    company: { id: "c1", name: "Gloria" },
    stock: 100,
    unitPerBox: 12,
    lowStockAlert: 10,
    salePrice: 2.5,
    costPrice: 2.0,
    productType: "ESTANDAR",
  },
]

const productInEntry = {
  name: "Leche Gloria",
  company: { id: "c1", name: "Gloria" },
  unitPerBox: 12,
  productType: "ESTANDAR",
}

// Dos lotes: lote 1 = 26 feb (más reciente), lote 2 = 20 feb
const mockEntriesTwoBatches = [
  {
    id: "e1",
    productId: "p1",
    quantity: 24,
    boxes: 2,
    entryDate: "2026-02-26T10:00:00Z",
    notes: null,
    product: productInEntry,
  },
  {
    id: "e2",
    productId: "p1",
    quantity: 12,
    boxes: 1,
    entryDate: "2026-02-20T09:00:00Z",
    notes: null,
    product: productInEntry,
  },
]

const defaultStockProps = {
  initialProducts: mockProducts,
  initialEntries: mockEntriesTwoBatches,
  activeBatch: { id: "b1", code: "LOTE-0001", status: "OPEN", number: 1 },
  totalBatches: 1,
}

test("muestra lotes agrupados por fecha en Últimos Ingresos", async () => {
  render(<StockClient {...defaultStockProps} />)
  // El botón del Lote #1 debe estar visible
  expect(screen.getByRole("button", { name: /Lote #1/i })).toBeInTheDocument()
})

test("colapsar lote oculta su contenido", async () => {
  const user = userEvent.setup()
  render(<StockClient {...defaultStockProps} />)

  // Contenido visible inicialmente (batch abierto por defecto)
  // Lote #1 es el más reciente (2026-02-26)
  const lote1Btn = screen.getByRole("button", { name: /Lote #1/i })
  expect(lote1Btn).toBeInTheDocument()

  // Colapsar
  await user.click(lote1Btn)

  // Después del click el botón sigue en DOM pero con aria-expanded="false"
  expect(lote1Btn).toHaveAttribute("aria-expanded", "false")
})
