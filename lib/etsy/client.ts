import axios, { type AxiosInstance } from "axios"
import { prisma } from "@/lib/db"

const TOKEN_URL = "https://api.etsy.com/v3/public/oauth/token"

interface TokenCache { token: string; expiry: number }
const tokenCache = new Map<string, TokenCache>()

async function getAccessToken(baseId?: string): Promise<string> {
  const cacheKey = baseId ?? "env"
  const cached = tokenCache.get(cacheKey)
  if (cached && Date.now() < cached.expiry) return cached.token

  let refreshToken: string
  let writeBack = false

  if (baseId) {
    const conn = await prisma.etsyConnection.findUnique({ where: { baseId } })
    if (!conn) throw new Error(`No Etsy connection found for base ${baseId}`)
    // Use cached access token if still valid
    if (conn.accessToken && conn.tokenExpiry && conn.tokenExpiry > new Date()) {
      const t = conn.accessToken
      tokenCache.set(cacheKey, { token: t, expiry: conn.tokenExpiry.getTime() })
      return t
    }
    refreshToken = conn.refreshToken
    writeBack = true
  } else {
    refreshToken = process.env.ETSY_REFRESH_TOKEN!
  }

  const res = await axios.post(
    TOKEN_URL,
    new URLSearchParams({
      grant_type: "refresh_token",
      client_id: process.env.ETSY_API_KEY!,
      refresh_token: refreshToken,
    }),
    { headers: { "Content-Type": "application/x-www-form-urlencoded" } }
  )

  const token: string = res.data.access_token
  const expiry = Date.now() + (res.data.expires_in - 60) * 1000
  tokenCache.set(cacheKey, { token, expiry })

  if (writeBack && baseId) {
    await prisma.etsyConnection.update({
      where: { baseId },
      data: { accessToken: token, tokenExpiry: new Date(expiry) },
    })
  }

  return token
}

export async function getEtsyClient(baseId?: string): Promise<AxiosInstance> {
  const token = await getAccessToken(baseId)
  const apiKey = process.env.ETSY_SHARED_SECRET
    ? `${process.env.ETSY_API_KEY}:${process.env.ETSY_SHARED_SECRET}`
    : process.env.ETSY_API_KEY!
  return axios.create({
    baseURL: "https://openapi.etsy.com/v3",
    headers: {
      Authorization: `Bearer ${token}`,
      "x-api-key": apiKey,
    },
  })
}
