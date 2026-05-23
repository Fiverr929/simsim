import { NextResponse } from "next/server"
import { prisma } from "@/lib/db"
import { getEtsyClient } from "@/lib/etsy/client"
import { apiError, handleApiError } from "@/lib/api"

export async function POST(_req: Request, { params }: { params: Promise<{ baseId: string }> }) {
  try {
    const { baseId } = await params
    const conn = await prisma.etsyConnection.findUnique({ where: { baseId } })
    if (!conn) return apiError("Store not connected", 404)

    const client = await getEtsyClient(baseId)

    // Resolve shopId/shopName if still pending from a partial OAuth
    let shopId = conn.shopId
    let shopName = conn.shopName
    if (!shopName || shopId === "pending") {
      const userId = conn.refreshToken.split(".")[0]
      const shopRes = await client.get(`/application/users/${userId}/shops`)
      const shop = shopRes.data.results?.[0] ?? shopRes.data
      shopId = String(shop?.shop_id)
      shopName = shop?.shop_name ?? shopId
      await prisma.etsyConnection.update({ where: { baseId }, data: { shopId, shopName } })
    }

    const [sectionsRes, returnRes, shippingRes] = await Promise.allSettled([
      client.get(`/application/shops/${shopId}/sections`),
      client.get(`/application/shops/${shopId}/policies/return`),
      client.get(`/application/shops/${shopId}/shipping-profiles`),
    ])

    const sections = sectionsRes.status === "fulfilled"
      ? (sectionsRes.value.data.results ?? []).map((s: { shop_section_id: number; title: string }) => ({ id: s.shop_section_id, title: s.title }))
      : []

    const returnPolicies = returnRes.status === "fulfilled"
      ? (returnRes.value.data.results ?? [returnRes.value.data]).filter(Boolean).map((p: { return_policy_id: number; policy_name?: string }) => ({ id: p.return_policy_id, name: p.policy_name ?? `Policy ${p.return_policy_id}` }))
      : []

    const shippingProfiles = shippingRes.status === "fulfilled"
      ? (shippingRes.value.data.results ?? []).map((p: { shipping_profile_id: number; title: string }) => ({ id: p.shipping_profile_id, title: p.title }))
      : []

    await prisma.etsyConnection.update({
      where: { baseId },
      data: {
        sections: JSON.stringify(sections),
        returnPolicies: JSON.stringify(returnPolicies),
        shippingProfiles: JSON.stringify(shippingProfiles),
        lastSynced: new Date(),
      },
    })

    return NextResponse.json({ sections, returnPolicies, shippingProfiles })
  } catch (err) {
    return handleApiError(err)
  }
}
