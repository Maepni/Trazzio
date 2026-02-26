// Este endpoint ya no se usa — settlements fue reemplazado por daily-sales
import { NextResponse } from "next/server"

export async function PATCH() {
  return NextResponse.json({ error: "Endpoint obsoleto. Usar /api/daily-sales" }, { status: 410 })
}
