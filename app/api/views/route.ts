import { NextResponse } from "next/server"
import { prisma } from "@/lib/db"
import { handleApiError, apiError } from "@/lib/api"

export async function POST(req: Request) {
  try {
    const body = await req.json()
    if (!body.tableId) return apiError("tableId required", 400)
    const count = await prisma.view.count({ where: { tableId: body.tableId } })
    const view = await prisma.view.create({
      data: {
        name: body.name ?? "View",
        type: body.type ?? "grid",
        config: JSON.stringify(body.config ?? {}),
        order: count,
        tableId: body.tableId,
      },
    })
    return NextResponse.json({ ...view, config: JSON.parse(view.config) }, { status: 201 })
  } catch (err) {
    return handleApiError(err)
  }
}
