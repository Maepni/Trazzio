export type ProductType = "ESTANDAR" | "LECHE" | "ARROZ"

export interface ProductLabels {
  container: string      // "Cajas" | "Bolsas" | "Costales"
  unit: string           // "Unidades" | "Latas" | "Kilos"
  containerShort: string // "caj." | "bol." | "cost."
  unitShort: string      // "und." | "latas" | "kg"
  containerPer: string   // "und/caja" | "latas/bolsa" | "kg/costal"
}

export function getProductLabels(type: ProductType | string | undefined): ProductLabels {
  switch (type) {
    case "LECHE":
      return {
        container: "Bolsas",
        unit: "Latas",
        containerShort: "bol.",
        unitShort: "latas",
        containerPer: "latas/bolsa",
      }
    case "ARROZ":
      return {
        container: "Costales",
        unit: "Kilos",
        containerShort: "cost.",
        unitShort: "kg",
        containerPer: "kg/costal",
      }
    default:
      return {
        container: "Cajas",
        unit: "Unidades",
        containerShort: "caj.",
        unitShort: "und.",
        containerPer: "und/caja",
      }
  }
}

export const PRODUCT_TYPE_OPTIONS: { value: ProductType; label: string }[] = [
  { value: "ESTANDAR", label: "Cajas / Unidades" },
  { value: "LECHE", label: "Bolsas / Latas" },
  { value: "ARROZ", label: "Costales / Kilos" },
]
