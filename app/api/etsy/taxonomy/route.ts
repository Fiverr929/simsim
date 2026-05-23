import { NextResponse } from "next/server"
import { prisma } from "@/lib/db"
import { getEtsyClient } from "@/lib/etsy/client"
import { handleApiError } from "@/lib/api"

export async function GET() {
  try {
    // Use any connected store's credentials (taxonomy is global)
    const conn = await prisma.etsyConnection.findFirst()
    const client = await getEtsyClient(conn?.baseId)
    const res = await client.get("/application/seller-taxonomy/nodes")
    return NextResponse.json(res.data.results ?? [])
  } catch (err) {
    return handleApiError(err)
  }
}
