import { NextResponse } from "next/server"
import { prisma } from "@/lib/db"
import { handleApiError, apiError } from "@/lib/api"

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const table = await prisma.table.findUnique({
      where: { id },
      include: {
        fields: { orderBy: { order: "asc" } },
        views: { orderBy: { order: "asc" } },
      },
    })
    if (!table) return apiError("Not found", 404)
    return NextResponse.json({
      ...table,
      fields: table.fields.map((f) => ({ ...f, config: JSON.parse(f.config) })),
      views: table.views.map((v) => ({ ...v, config: JSON.parse(v.config) })),
    })
  } catch (err) {
    return handleApiError(err)
  }
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const body = await req.json()
    const data: Record<string, unknown> = {}
    if (body.name !== undefined) data.name = body.name
    if (body.order !== undefined) data.order = body.order
    const table = await prisma.table.update({ where: { id }, data })
    return NextResponse.json(table)
  } catch (err) {
    return handleApiError(err)
  }
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    await prisma.table.delete({ where: { id } })
    return new NextResponse(null, { status: 204 })
  } catch (err) {
    return handleApiError(err)
  }
}
