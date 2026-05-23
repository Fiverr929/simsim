import { NextResponse } from "next/server"
import { prisma } from "@/lib/db"
import { getEtsyClient } from "@/lib/etsy/client"
import { apiError, handleApiError } from "@/lib/api"

export async function POST(req: Request) {
  try {
    const { baseId, shopId, refreshToken } = await req.json()
    if (!baseId || !shopId || !refreshToken) return apiError("baseId, shopId and refreshToken required", 400)

    // Save credentials first so getEtsyClient can use them
    await prisma.etsyConnection.upsert({
      where: { baseId },
      create: { baseId, shopId: String(shopId), refreshToken },
      update: { shopId: String(shopId), refreshToken, accessToken: null, tokenExpiry: null },
    })

    // Validate by fetching shop info
    const client = await getEtsyClient(baseId)
    const shopRes = await client.get(`/application/shops/${shopId}`)
    const shopName: string = shopRes.data.shop_name ?? shopRes.data.name ?? String(shopId)

    await prisma.etsyConnection.update({
      where: { baseId },
      data: { shopName },
    })

    return NextResponse.json({ shopName, shopId })
  } catch (err) {
    return handleApiError(err)
  }
}
