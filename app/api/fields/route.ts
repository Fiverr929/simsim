import { NextResponse } from "next/server"
import { prisma } from "@/lib/db"
import { handleApiError, apiError } from "@/lib/api"

export async function POST(req: Request) {
  try {
    const body = await req.json()
    if (!body.tableId) return apiError("tableId required", 400)
    const count = await prisma.field.count({ where: { tableId: body.tableId } })
    const field = await prisma.field.create({
      data: {
        name: body.name ?? "Field",
        type: body.type ?? "text",
        config: JSON.stringify(body.config ?? {}),
        order: count,
        tableId: body.tableId,
      },
    })
    return NextResponse.json({ ...field, config: JSON.parse(field.config) }, { status: 201 })
  } catch (err) {
    return handleApiError(err)
  }
}
