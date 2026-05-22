import { NextResponse } from "next/server"
import { prisma } from "@/lib/db"
import { handleApiError, apiError } from "@/lib/api"

export async function POST(req: Request) {
  try {
    const body = await req.json()
    if (!body.baseId) return apiError("baseId required", 400)
    const count = await prisma.table.count({ where: { baseId: body.baseId } })
    const table = await prisma.table.create({
      data: { name: body.name ?? "Table", order: count, baseId: body.baseId },
    })
    await prisma.field.create({
      data: { name: "Name", type: "text", isPrimary: true, order: 0, tableId: table.id },
    })
    await prisma.view.create({
      data: { name: "Grid", type: "grid", order: 0, tableId: table.id },
    })
    const full = await prisma.table.findUnique({
      where: { id: table.id },
      include: { fields: { orderBy: { order: "asc" } }, views: { orderBy: { order: "asc" } } },
    })
    return NextResponse.json(full, { status: 201 })
  } catch (err) {
    return handleApiError(err)
  }
}
