import { NextResponse } from "next/server"
import { prisma } from "@/lib/db"
import { handleApiError } from "@/lib/api"

export async function GET() {
  try {
    const spaces = await prisma.space.findMany({ orderBy: { createdAt: "asc" } })
    return NextResponse.json(spaces)
  } catch (err) {
    return handleApiError(err)
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}))
    const space = await prisma.space.create({
      data: { name: body.name ?? "New Space", icon: body.icon ?? "" },
    })

    const base = await prisma.base.create({
      data: { name: "My Base", icon: "", spaceId: space.id },
    })

    const table = await prisma.table.create({
      data: { name: "Table 1", order: 0, baseId: base.id },
    })

    await prisma.field.create({
      data: { name: "Name", type: "text", isPrimary: true, order: 0, tableId: table.id },
    })

    const view = await prisma.view.create({
      data: { name: "Grid", type: "grid", order: 0, tableId: table.id },
    })

    return NextResponse.json({ ...space, defaultBaseId: base.id, defaultTableId: table.id, defaultViewId: view.id }, { status: 201 })
  } catch (err) {
    return handleApiError(err)
  }
}
