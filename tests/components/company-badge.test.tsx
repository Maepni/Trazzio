import { render, screen } from "@testing-library/react"
import { CompanyBadge } from "@/components/shared/company-badge"

test("renders company name and aria label", () => {
  render(<CompanyBadge companyName="Nestle" colorKey="nestle" />)
  expect(screen.getByText("Nestle")).toBeInTheDocument()
  expect(screen.getByLabelText("Empresa Nestle")).toBeInTheDocument()
})

test("shows text + non-color indicator", () => {
  render(<CompanyBadge companyName="Alicorp" colorKey="alicorp" />)
  expect(screen.getByText("Alicorp")).toBeVisible()
  expect(screen.getByText("EMP")).toBeVisible()
})
