import { render, screen } from "@testing-library/react"
import { vi } from "vitest"

vi.mock("next/navigation", () => ({
  usePathname: () => "/dashboard",
}))

vi.mock("next/link", () => ({
  default: ({ children, href }: { children: React.ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  ),
}))

import { AdminSidebar } from "@/components/admin/admin-sidebar"

test("does not render Reportes nav item", () => {
  render(<AdminSidebar />)
  expect(screen.queryByText("Reportes")).not.toBeInTheDocument()
})
