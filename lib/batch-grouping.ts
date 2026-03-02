export function buildVisualBatches<T extends { createdAt: string }>(
  items: T[]
): (T & { label: string })[] {
  return [...items]
    .sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt))
    .map((item, index) => ({ ...item, label: `Lote #${index + 1}` }))
}

/**
 * Evalúa el estado del lote actual.
 * - Si las asignaciones tienen batchId + batch.status, usa el batch persistido.
 * - Fallback: agrupa por startDate (datos legacy sin batchId).
 * - currentBatchClosed: true si el lote más reciente está completamente cerrado.
 * - nextBatchEnabled: true cuando currentBatchClosed es true.
 */
export function getBatchProgress(
  assignments: {
    startDate: string
    status: string
    batchId?: string | null
    batch?: { id: string; status: string } | null
  }[]
): { currentBatchClosed: boolean; nextBatchEnabled: boolean } {
  if (assignments.length === 0) {
    return { currentBatchClosed: false, nextBatchEnabled: false }
  }

  // Preferir lógica por batch persistido cuando batchId está disponible
  const withBatch = assignments.filter((a) => a.batchId && a.batch)
  if (withBatch.length > 0) {
    // Encontrar el batch más reciente por startDate
    const latestDate = withBatch
      .map((a) => a.startDate.toString().slice(0, 10))
      .reduce((max, d) => (d > max ? d : max))

    const currentBatchItems = withBatch.filter(
      (a) => a.startDate.toString().slice(0, 10) === latestDate
    )

    // El lote está cerrado si batch.status === "CLOSED" para todas sus asignaciones
    const allBatchClosed = currentBatchItems.every((a) => a.batch?.status === "CLOSED")

    return { currentBatchClosed: allBatchClosed, nextBatchEnabled: allBatchClosed }
  }

  // Fallback: agrupar por startDate (datos legacy sin batchId)
  const days = assignments.map((a) => a.startDate.toString().slice(0, 10))
  const currentDay = days.reduce((max, d) => (d > max ? d : max), days[0])

  const currentBatchItems = assignments.filter(
    (a) => a.startDate.toString().slice(0, 10) === currentDay
  )

  const allClosed = currentBatchItems.every((a) => a.status === "CLOSED")

  return {
    currentBatchClosed: allClosed,
    nextBatchEnabled: allClosed,
  }
}
