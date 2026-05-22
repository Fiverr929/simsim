import { NextResponse } from "next/server"
import { prisma } from "@/lib/db"
import { handleApiError, apiError } from "@/lib/api"

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url)
    const spaceId = searchParams.get("spaceId")
    if (!spaceId) return apiError("spaceId required", 400)
    const bases = await prisma.base.findMany({
      where: { spaceId },
      orderBy: { createdAt: "asc" },
      include: { tables: { orderBy: { order: "asc" }, select: { id: true, name: true, order: true, baseId: true } } },
    })
    return NextResponse.json(bases.map((b) => ({ ...b, config: JSON.parse(b.config) })))
  } catch (err) {
    return handleApiError(err)
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json()
    if (!body.spaceId) return apiError("spaceId required", 400)
    const base = await prisma.base.create({
      data: { name: body.name ?? "New Base", icon: "", spaceId: body.spaceId },
      include: { tables: true },
    })
    return NextResponse.json(base, { status: 201 })
  } catch (err) {
    return handleApiError(err)
  }
}
