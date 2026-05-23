import { NextResponse } from "next/server"
import { generateCodeVerifier, generateCodeChallenge, saveOAuthState } from "@/lib/etsy/pkce"
import { apiError } from "@/lib/api"

const SCOPES = "listings_w listings_r shops_r profile_r email_r"
const REDIRECT_URI = "http://localhost:3000/api/etsy/oauth/callback"

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const baseId = searchParams.get("baseId")
  if (!baseId) return apiError("baseId required", 400)

  const codeVerifier = generateCodeVerifier()
  const codeChallenge = generateCodeChallenge(codeVerifier)
  const state = saveOAuthState(baseId, codeVerifier)

  const params = new URLSearchParams({
    response_type: "code",
    client_id: process.env.ETSY_API_KEY!,
    redirect_uri: REDIRECT_URI,
    scope: SCOPES,
    state,
    code_challenge: codeChallenge,
    code_challenge_method: "S256",
  })

  return NextResponse.redirect(`https://www.etsy.com/oauth/connect?${params}`)
}
