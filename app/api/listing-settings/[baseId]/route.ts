import { NextResponse } from "next/server"
import { prisma } from "@/lib/db"
import { handleApiError, apiError } from "@/lib/api"
import { emptySettings } from "@/types/listing-settings"
import type { ListingSettings } from "@/types/listing-settings"
import type { BaseConfig } from "@/types/core"

export async function GET(_req: Request, { params }: { params: Promise<{ baseId: string }> }) {
  try {
    const { baseId } = await params
    const base = await prisma.base.findUnique({ where: { id: baseId } })
    if (!base) return apiError("Base not found", 404)
    const config = JSON.parse(base.config) as BaseConfig
    return NextResponse.json(config.listingSettings ?? emptySettings())
  } catch (err) {
    return handleApiError(err)
  }
}

export async function PATCH(req: Request, { params }: { params: Promise<{ baseId: string }> }) {
  try {
    const { baseId } = await params
    const settings: Partial<ListingSettings> = await req.json()
    const base = await prisma.base.findUnique({ where: { id: baseId } })
    if (!base) return apiError("Base not found", 404)
    const config = JSON.parse(base.config) as BaseConfig
    const merged: BaseConfig = {
      ...config,
      listingSettings: { ...(config.listingSettings ?? emptySettings()), ...settings },
    }
    await prisma.base.update({ where: { id: baseId }, data: { config: JSON.stringify(merged) } })

    // Sync Category field options whenever categories change
    if (settings.categories !== undefined) {
      const categoryOptions = merged.listingSettings!.categories.map((c) => ({
        id: c.id,
        label: c.name,
        color: c.color,
      }))
      const tables = await prisma.table.findMany({
        where: { baseId },
        include: { fields: { where: { name: "Category" } } },
      })
      for (const table of tables) {
        for (const field of table.fields) {
          const existing = JSON.parse(field.config) as Record<string, unknown>
          await prisma.field.update({
            where: { id: field.id },
            data: { config: JSON.stringify({ ...existing, options: categoryOptions }) },
          })
        }
      }
    }

    return NextResponse.json(merged.listingSettings)
  } catch (err) {
    return handleApiError(err)
  }
}
