import { NextResponse } from "next/server"
import { prisma } from "@/lib/db"
import { apiError } from "@/lib/api"

// Reads accessToken directly from DB and calls Etsy with raw fetch — bypasses any Axios header issues
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const baseId = searchParams.get("baseId")
  if (!baseId) return apiError("baseId required", 400)

  const apiKey = process.env.ETSY_API_KEY
  const conn = await prisma.etsyConnection.findUnique({ where: { baseId } })
  if (!conn) return NextResponse.json({ error: "No connection record", apiKeySet: !!apiKey })

  const token = conn.accessToken
  if (!token) return NextResponse.json({ error: "No access token stored" })

  const sharedSecret = process.env.ETSY_SHARED_SECRET
  const combinedKey = sharedSecret ? `${apiKey}:${sharedSecret}` : (apiKey ?? "")
  const headers: Record<string, string> = {
    "Authorization": `Bearer ${token}`,
    "x-api-key": combinedKey,
  }

  // Parse user_id from refresh token — Etsy format is "{user_id}.{random}"
  const userId = conn.refreshToken?.split(".")[0]

  // Test shops endpoint with parsed user_id
  const shopFetch = await fetch(`https://openapi.etsy.com/v3/application/users/${userId}/shops`, { headers })
  const shopBody = await shopFetch.json()

  return NextResponse.json({
    tokenExpiry: conn.tokenExpiry,
    tokenExpired: conn.tokenExpiry ? new Date(conn.tokenExpiry) < new Date() : "no expiry",
    parsedUserId: userId,
    shopStatus: shopFetch.status,
    shopBody,
  })
}
