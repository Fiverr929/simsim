import { NextResponse } from "next/server"
import { prisma } from "@/lib/db"
import { apiError, handleApiError } from "@/lib/api"

export async function DELETE(req: Request) {
  try {
    const { searchParams } = new URL(req.url)
    const baseId = searchParams.get("baseId")
    if (!baseId) return apiError("baseId required", 400)
    await prisma.etsyConnection.deleteMany({ where: { baseId } })
    return new NextResponse(null, { status: 204 })
  } catch (err) {
    return handleApiError(err)
  }
}
