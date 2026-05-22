import { NextResponse } from "next/server"
import { prisma } from "@/lib/db"
import { handleApiError, apiError } from "@/lib/api"

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url)
    const tableId = searchParams.get("tableId")
    if (!tableId) return apiError("tableId required", 400)
    const records = await prisma.record.findMany({
      where: { tableId },
      orderBy: { order: "asc" },
    })
    return NextResponse.json(records.map((r) => ({ ...r, data: JSON.parse(r.data) })))
  } catch (err) {
    return handleApiError(err)
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}))
    const { searchParams } = new URL(req.url)
    const tableId = body.tableId ?? searchParams.get("tableId")
    if (!tableId) return apiError("tableId required", 400)
    const count = await prisma.record.count({ where: { tableId } })
    const record = await prisma.record.create({
      data: { tableId, order: count, data: JSON.stringify(body.data ?? {}) },
    })
    return NextResponse.json({ ...record, data: JSON.parse(record.data) }, { status: 201 })
  } catch (err) {
    return handleApiError(err)
  }
}
