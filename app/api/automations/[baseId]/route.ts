import { NextResponse } from "next/server"
import { prisma } from "@/lib/db"
import { handleApiError, apiError } from "@/lib/api"
import type { BaseConfig } from "@/types/core"
import type { Automation } from "@/types/automation"

export async function GET(_req: Request, { params }: { params: Promise<{ baseId: string }> }) {
  try {
    const { baseId } = await params
    const base = await prisma.base.findUnique({ where: { id: baseId } })
    if (!base) return apiError("Base not found", 404)
    const config = JSON.parse(base.config) as BaseConfig
    return NextResponse.json(config.automations ?? [])
  } catch (err) {
    return handleApiError(err)
  }
}

export async function PATCH(req: Request, { params }: { params: Promise<{ baseId: string }> }) {
  try {
    const { baseId } = await params
    const automations: Automation[] = await req.json()
    if (!Array.isArray(automations)) return apiError("Expected array of automations", 400)

    const base = await prisma.base.findUnique({ where: { id: baseId } })
    if (!base) return apiError("Base not found", 404)

    const config = JSON.parse(base.config) as BaseConfig
    const updated: BaseConfig = { ...config, automations }
    await prisma.base.update({ where: { id: baseId }, data: { config: JSON.stringify(updated) } })

    return NextResponse.json(automations)
  } catch (err) {
    return handleApiError(err)
  }
}
