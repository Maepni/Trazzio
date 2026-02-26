import { z } from "zod"
import { describe, test, expect } from "vitest"

// Schema idéntico al de la API
const stockSchema = z.object({
  productId: z.string().min(1),
  quantity: z.number().int().refine((v) => v !== 0, "No puede ser 0"),
  boxes: z.number().int().optional(),
  notes: z.string().optional(),
})

describe("stock schema — razón opcional", () => {
  test("acepta ajuste sin notas", () => {
    const result = stockSchema.safeParse({ productId: "p1", quantity: -3 })
    expect(result.success).toBe(true)
  })

  test("acepta ajuste con notas convertidas a undefined", () => {
    const emptyStr = ""
    const notes = emptyStr.trim() ? emptyStr : undefined
    const result = stockSchema.safeParse({ productId: "p1", quantity: -3, notes })
    expect(result.success).toBe(true)
  })

  test("acepta ajuste con razón", () => {
    const result = stockSchema.safeParse({ productId: "p1", quantity: -3, notes: "[AJUSTE] caja rota" })
    expect(result.success).toBe(true)
  })
})
