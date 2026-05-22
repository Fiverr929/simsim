import { NextResponse } from "next/server"
import { prisma } from "@/lib/db"
import { handleApiError } from "@/lib/api"

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const body = await req.json()
    const existing = await prisma.record.findUnique({ where: { id } })
    if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 })
    const existingData = JSON.parse(existing.data) as Record<string, unknown>
    const merged = { ...existingData, ...(body.data ?? {}) }
    const record = await prisma.record.update({
      where: { id },
      data: { data: JSON.stringify(merged) },
    })
    return NextResponse.json({ ...record, data: JSON.parse(record.data) })
  } catch (err) {
    return handleApiError(err)
  }
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    await prisma.record.delete({ where: { id } })
    return new NextResponse(null, { status: 204 })
  } catch (err) {
    return handleApiError(err)
  }
}
