import { NextResponse } from "next/server"

export function apiError(message: string, status: number) {
  return NextResponse.json({ error: message }, { status })
}

export function handleApiError(err: unknown): ReturnType<typeof apiError> {
  if (err instanceof Error && err.message.includes("not found")) {
    return apiError("Not found", 404)
  }
  console.error("API error:", err)
  return apiError("Internal server error", 500)
}
