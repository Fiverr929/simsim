import { NextResponse } from "next/server"
import { prisma } from "@/lib/db"
import { handleApiError, apiError } from "@/lib/api"

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}))
    const items: { id: string; order: number }[] = body.items ?? []
    if (!items.length) return apiError("items required", 400)
    await prisma.$transaction(
      items.map(({ id, order }) => prisma.record.update({ where: { id }, data: { order } }))
    )
    return new NextResponse(null, { status: 204 })
  } catch (err) {
    return handleApiError(err)
  }
}
