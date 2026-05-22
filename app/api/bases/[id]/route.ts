import { NextResponse } from "next/server"
import { prisma } from "@/lib/db"
import { handleApiError } from "@/lib/api"

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const body = await req.json()
    const data: Record<string, string> = {}
    if (body.name !== undefined) data.name = body.name
    if (body.icon !== undefined) data.icon = body.icon
    if (body.config !== undefined) data.config = JSON.stringify(body.config)
    const base = await prisma.base.update({ where: { id }, data })
    return NextResponse.json({ ...base, config: JSON.parse(base.config) })
  } catch (err) {
    return handleApiError(err)
  }
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    await prisma.base.delete({ where: { id } })
    return new NextResponse(null, { status: 204 })
  } catch (err) {
    return handleApiError(err)
  }
}
