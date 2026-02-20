import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatCurrency(amount: number | string | null | undefined): string {
  const num = Number(amount ?? 0)
  return `S/ ${num.toFixed(2)}`
}

export function formatUnitsToBoxes(units: number, unitPerBox: number): string {
  const boxes = Math.floor(units / unitPerBox)
  const remaining = units % unitPerBox
  if (boxes === 0) return `${remaining} und.`
  if (remaining === 0) return `${boxes} caj.`
  return `${boxes} caj. + ${remaining} und.`
}

export function formatDate(date: Date | string): string {
  const d = new Date(date)
  return d.toLocaleDateString("es-PE", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    timeZone: "America/Lima",
  })
}

export function formatDateTime(date: Date | string): string {
  const d = new Date(date)
  return d.toLocaleString("es-PE", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "America/Lima",
  })
}

export function getTodayStart(): Date {
  const now = new Date()
  const lima = new Date(now.toLocaleString("en-US", { timeZone: "America/Lima" }))
  lima.setHours(0, 0, 0, 0)
  return lima
}

export function getTodayEnd(): Date {
  const now = new Date()
  const lima = new Date(now.toLocaleString("en-US", { timeZone: "America/Lima" }))
  lima.setHours(23, 59, 59, 999)
  return lima
}

/** Serializa objetos de Prisma (convierte Decimal, Date, BigInt a tipos planos) */
export function serialize<T>(data: T): T {
  return JSON.parse(JSON.stringify(data))
}
