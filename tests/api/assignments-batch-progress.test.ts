import { getBatchProgress } from "@/lib/batch-grouping"

// Fixture: un lote con 2 trabajadores. Uno cerrado, uno activo.
const fixturesMixed = [
  {
    id: "a1",
    workerId: "w1",
    startDate: "2026-02-26T08:00:00Z",
    status: "ACTIVE",
  },
  {
    id: "a2",
    workerId: "w2",
    startDate: "2026-02-26T08:00:00Z",
    status: "CLOSED",
  },
]

// Fixture: lote completamente cerrado (todos CLOSED)
const fixturesAllClosed = [
  {
    id: "a1",
    workerId: "w1",
    startDate: "2026-02-26T08:00:00Z",
    status: "CLOSED",
  },
  {
    id: "a2",
    workerId: "w2",
    startDate: "2026-02-26T08:00:00Z",
    status: "CLOSED",
  },
]

// Fixture: dos lotes, el más reciente completamente cerrado
const fixturesTwoBatches = [
  {
    id: "a1",
    workerId: "w1",
    startDate: "2026-02-26T08:00:00Z", // lote 1 (más reciente)
    status: "CLOSED",
  },
  {
    id: "a2",
    workerId: "w2",
    startDate: "2026-02-20T08:00:00Z", // lote 2 (más antiguo)
    status: "ACTIVE",
  },
]

test("lote no está cerrado si alguna asignación sigue ACTIVE", () => {
  const result = getBatchProgress(fixturesMixed)
  expect(result.currentBatchClosed).toBe(false)
  expect(result.nextBatchEnabled).toBe(false)
})

test("lote sí está cerrado cuando todas sus asignaciones son CLOSED", () => {
  const result = getBatchProgress(fixturesAllClosed)
  expect(result.currentBatchClosed).toBe(true)
  expect(result.nextBatchEnabled).toBe(true)
})

test("con dos lotes, solo evalúa el más reciente como lote actual", () => {
  const result = getBatchProgress(fixturesTwoBatches)
  // El lote 1 (más reciente, 26 feb) está todo cerrado
  expect(result.currentBatchClosed).toBe(true)
  expect(result.nextBatchEnabled).toBe(true)
})

test("lista vacía devuelve no cerrado", () => {
  const result = getBatchProgress([])
  expect(result.currentBatchClosed).toBe(false)
  expect(result.nextBatchEnabled).toBe(false)
})

test("usa batch.status CLOSED aunque assignment.status sea ACTIVE", () => {
  const assignments = [
    { id: "a1", startDate: "2026-02-26T08:00:00Z", status: "ACTIVE", batchId: "b1", batch: { id: "b1", status: "CLOSED" } },
    { id: "a2", startDate: "2026-02-26T08:00:00Z", status: "ACTIVE", batchId: "b1", batch: { id: "b1", status: "CLOSED" } },
  ]
  const result = getBatchProgress(assignments)
  expect(result.currentBatchClosed).toBe(true)
  expect(result.nextBatchEnabled).toBe(true)
})
