import { NextResponse } from "next/server"
import { prisma } from "@/lib/db"
import { handleApiError, apiError } from "@/lib/api"

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}))
    const ids: string[] = body.ids ?? []
    if (!ids.length) return apiError("ids required", 400)
    await prisma.record.deleteMany({ where: { id: { in: ids } } })
    return new NextResponse(null, { status: 204 })
  } catch (err) {
    return handleApiError(err)
  }
}
