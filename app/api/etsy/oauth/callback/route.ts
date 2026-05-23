import { NextResponse } from "next/server"
import axios from "axios"
import { prisma } from "@/lib/db"
import { getEtsyClient } from "@/lib/etsy/client"
import { consumeOAuthState } from "@/lib/etsy/pkce"

const REDIRECT_URI = "http://localhost:3000/api/etsy/oauth/callback"
const TOKEN_URL = "https://api.etsy.com/v3/public/oauth/token"

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const code = searchParams.get("code")
  const state = searchParams.get("state")
  const error = searchParams.get("error")

  if (error) {
    return NextResponse.redirect(`http://localhost:3000/?etsy_error=${encodeURIComponent(error)}`)
  }

  if (!code || !state) {
    return NextResponse.redirect("http://localhost:3000/?etsy_error=missing_params")
  }

  const pending = consumeOAuthState(state)
  if (!pending) {
    return NextResponse.redirect("http://localhost:3000/?etsy_error=invalid_state")
  }

  const { baseId, codeVerifier } = pending

  // Exchange code for tokens
  let refreshToken: string
  let accessToken: string
  let expiresIn: number
  try {
    const res = await axios.post(
      TOKEN_URL,
      new URLSearchParams({
        grant_type: "authorization_code",
        client_id: process.env.ETSY_API_KEY!,
        redirect_uri: REDIRECT_URI,
        code,
        code_verifier: codeVerifier,
      }),
      { headers: { "Content-Type": "application/x-www-form-urlencoded" } }
    )
    refreshToken = res.data.refresh_token
    accessToken = res.data.access_token
    expiresIn = res.data.expires_in ?? 3600
  } catch {
    return NextResponse.redirect("http://localhost:3000/?etsy_error=token_exchange_failed")
  }

  // Get shop info
  const tokenExpiry = new Date(Date.now() + (expiresIn - 60) * 1000)
  const tempConn = await prisma.etsyConnection.upsert({
    where: { baseId },
    create: { baseId, shopId: "pending", refreshToken, accessToken, tokenExpiry },
    update: { refreshToken, accessToken, tokenExpiry, shopId: "pending" },
  })

  let shopId: string
  let shopName: string
  try {
    const client = await getEtsyClient(baseId)
    // Parse user_id from refresh token (Etsy format: "{user_id}.{random}")
    const userId = refreshToken.split(".")[0]
    const shopRes = await client.get(`/application/users/${userId}/shops`)
    const shop = shopRes.data.results?.[0] ?? shopRes.data
    shopId = String(shop?.shop_id)
    shopName = shop?.shop_name ?? shopId
  } catch {
    return NextResponse.redirect(`http://localhost:3000/?etsy_error=shop_fetch_failed`)
  }

  await prisma.etsyConnection.update({
    where: { baseId },
    data: { shopId, shopName },
  })

  // Sync store data
  try {
    const client = await getEtsyClient(baseId)
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
  } catch { /* sync failures are non-fatal */ }

  return NextResponse.redirect(`http://localhost:3000/?etsy_connected=${baseId}`)
}
