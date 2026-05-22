import axios, { type AxiosInstance } from "axios"

const TOKEN_URL = "https://api.etsy.com/v3/public/oauth/token"

let cachedToken: string | null = null
let tokenExpiry = 0

async function getAccessToken(): Promise<string> {
  if (cachedToken && Date.now() < tokenExpiry) return cachedToken

  const res = await axios.post(
    TOKEN_URL,
    new URLSearchParams({
      grant_type: "refresh_token",
      client_id: process.env.ETSY_API_KEY!,
      refresh_token: process.env.ETSY_REFRESH_TOKEN!,
    }),
    { headers: { "Content-Type": "application/x-www-form-urlencoded" } }
  )

  cachedToken = res.data.access_token
  tokenExpiry = Date.now() + (res.data.expires_in - 60) * 1000
  return cachedToken!
}

export async function getEtsyClient(): Promise<AxiosInstance> {
  const token = await getAccessToken()
  return axios.create({
    baseURL: "https://openapi.etsy.com/v3",
    headers: {
      Authorization: `Bearer ${token}`,
      "x-api-key": process.env.ETSY_API_KEY!,
    },
  })
}
