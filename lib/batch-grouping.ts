export function buildVisualBatches<T extends { createdAt: string }>(
  items: T[]
): (T & { label: string })[] {
  return [...items]
    .sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt))
    .map((item, index) => ({ ...item, label: `Lote #${index + 1}` }))
}
