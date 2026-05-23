import { NextResponse } from "next/server"
import { prisma } from "@/lib/db"
import { apiError, handleApiError } from "@/lib/api"

export async function GET(_req: Request, { params }: { params: Promise<{ baseId: string }> }) {
  try {
    const { baseId } = await params
    const conn = await prisma.etsyConnection.findUnique({ where: { baseId } })
    if (!conn) return NextResponse.json({ connected: false })

    return NextResponse.json({
      connected: true,
      shopName: conn.shopName,
      lastSynced: conn.lastSynced,
      sections: JSON.parse(conn.sections),
      returnPolicies: JSON.parse(conn.returnPolicies),
      shippingProfiles: JSON.parse(conn.shippingProfiles),
    })
  } catch (err) {
    return handleApiError(err)
  }
}
