import { buildVisualBatches } from "@/lib/batch-grouping"
import { describe, test, expect } from "vitest"

describe("buildVisualBatches", () => {
  test("assigns sequential labels Lote #1, #2 (desc by date)", () => {
    const batches = buildVisualBatches([
      { id: "a", createdAt: "2026-02-26T10:00:00Z" },
      { id: "b", createdAt: "2026-02-26T09:00:00Z" },
    ])
    expect(batches[0].label).toBe("Lote #1")
    expect(batches[1].label).toBe("Lote #2")
  })

  test("más reciente queda en Lote #1", () => {
    const batches = buildVisualBatches([
      { id: "old", createdAt: "2026-01-01T00:00:00Z" },
      { id: "new", createdAt: "2026-02-26T12:00:00Z" },
    ])
    expect(batches[0].id).toBe("new")
    expect(batches[0].label).toBe("Lote #1")
  })

  test("lista vacía devuelve vacío", () => {
    expect(buildVisualBatches([])).toEqual([])
  })
})
