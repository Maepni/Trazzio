import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { ProductSearchCombobox } from "@/components/shared/product-search-combobox"

const products = [
  { id: "1", name: "Leche Gloria", company: { name: "Nestle" }, stock: 12 },
  { id: "2", name: "Arroz Costeño", company: { name: "Alicorp" }, stock: 5 },
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
