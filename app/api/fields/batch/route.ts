import { NextResponse } from "next/server"
import { prisma } from "@/lib/db"
import { handleApiError, apiError } from "@/lib/api"

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}))
    // Batch create
    if (body.fields) {
      const fields: { name: string; type: string }[] = body.fields
      const tableId: string = body.tableId ?? ""
      if (!tableId || !fields.length) return apiError("tableId and fields required", 400)
      const count = await prisma.field.count({ where: { tableId } })
      const created = await Promise.all(
        fields.map((f, i) =>
          prisma.field.create({
            data: { tableId, name: f.name, type: f.type ?? "text", order: count + i, config: "{}" },
          })
        )
      )
      return NextResponse.json(created.map((f) => ({ ...f, config: JSON.parse(f.config) })), { status: 201 })
    }
    // Batch delete
    const ids: string[] = body.ids ?? []
    if (!ids.length) return apiError("ids or fields required", 400)
    await prisma.field.deleteMany({ where: { id: { in: ids } } })
    return new NextResponse(null, { status: 204 })
  } catch (err) {
    return handleApiError(err)
  }
}
