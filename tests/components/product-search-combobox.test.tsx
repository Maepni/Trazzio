import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { vi } from "vitest"
import { ProductSearchCombobox } from "@/components/shared/product-search-combobox"

const products = [
  { id: "1", name: "Leche Gloria", company: { name: "Nestle" }, stock: 12, unitPerBox: 12 },
  { id: "2", name: "Arroz Costeño", company: { name: "Alicorp" }, stock: 5, unitPerBox: 1 },
]

test("filters products by name", async () => {
  render(<ProductSearchCombobox products={products} onSelect={() => {}} />)
  await userEvent.type(screen.getByPlaceholderText(/buscar producto o empresa/i), "Leche")
  expect(screen.getByText("Leche Gloria")).toBeInTheDocument()
  expect(screen.queryByText("Arroz Costeño")).not.toBeInTheDocument()
})

test("filters products by company name", async () => {
  render(<ProductSearchCombobox products={products} onSelect={() => {}} />)
  await userEvent.type(screen.getByPlaceholderText(/buscar producto o empresa/i), "nest")
  expect(screen.getByText("Leche Gloria")).toBeInTheDocument()
  expect(screen.queryByText("Arroz Costeño")).not.toBeInTheDocument()
})

test("shows no results message when nothing matches", async () => {
  render(<ProductSearchCombobox products={products} onSelect={() => {}} />)
  await userEvent.type(screen.getByPlaceholderText(/buscar producto o empresa/i), "xyz")
  expect(screen.getByText(/sin resultados/i)).toBeInTheDocument()
})

test("tiene role combobox accesible", () => {
  render(<ProductSearchCombobox products={products} onSelect={() => {}} />)
  expect(screen.getByRole("combobox")).toBeInTheDocument()
})

test("busca por código de producto", async () => {
  const productsWithCode = [
    { id: "1", name: "Leche Entera", company: { name: "Nestle" }, stock: 12, unitPerBox: 12, code: "COD-101" },
    { id: "2", name: "Arroz Costeño", company: { name: "Alicorp" }, stock: 5, unitPerBox: 1, code: "COD-202" },
  ]
  render(<ProductSearchCombobox products={productsWithCode} onSelect={() => {}} />)
  await userEvent.type(screen.getByPlaceholderText(/buscar producto o empresa/i), "COD-101")
  expect(screen.getByText("Leche Entera")).toBeInTheDocument()
  expect(screen.queryByText("Arroz Costeño")).not.toBeInTheDocument()
})

test("selecciona producto con teclado ArrowDown + Enter", async () => {
  const onSelect = vi.fn()
  const user = userEvent.setup()
  render(<ProductSearchCombobox products={products} onSelect={onSelect} />)

  await user.type(screen.getByRole("combobox"), "Leche")
  expect(screen.getByText("Leche Gloria")).toBeInTheDocument()

  await user.keyboard("{ArrowDown}")
  await user.keyboard("{Enter}")

  expect(onSelect).toHaveBeenCalledWith(
    expect.objectContaining({ name: "Leche Gloria" })
  )
})
