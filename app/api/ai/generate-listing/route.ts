import { NextResponse } from "next/server"
import { readFile } from "fs/promises"
import { join } from "path"
import { randomUUID } from "crypto"
import { prisma } from "@/lib/db"
import { handleApiError, apiError } from "@/lib/api"
import type { CellValue } from "@/types/core"

const MODEL = "gemini-2.5-flash"

const PROMPT = `You are an expert Etsy seller specializing in digital products. Analyze the product images and generate optimized Etsy listing content.

Return ONLY valid JSON — no markdown, no explanation:
{
  "title": "keyword-rich title, max 140 chars, lead with the most important keyword",
  "description": "3-5 paragraphs, weave in SEO keywords naturally, conversational tone, cover: what it is, why they'll love it, what's included, how to use it",
  "tags": ["tag1", "tag2", ..., "tag13"]
}

Tags rules: exactly 13 tags, max 20 chars each, lowercase, most relevant first.`

function getMimeType(url: string): string {
  const ext = url.split(".").pop()?.toLowerCase()
  switch (ext) {
    case "jpg":
    case "jpeg": return "image/jpeg"
    case "png": return "image/png"
    case "webp": return "image/webp"
    case "gif": return "image/gif"
    default: return "image/jpeg"
  }
}

async function callGoogleAPI(imageParts: Array<{ inline_data: { mime_type: string; data: string } }>, prompt: string) {
  const apiKey = process.env.GOOGLE_API_KEY
  if (!apiKey) throw new Error("GOOGLE_API_KEY not set")

  const url = `https://aiplatform.googleapis.com/v1/publishers/google/models/${MODEL}:generateContent?key=${apiKey}`

  const body = {
    contents: [{
      role: "user",
      parts: [...imageParts, { text: prompt }],
    }],
    generationConfig: { responseMimeType: "application/json" },
    safetySettings: [
      { category: "HARM_CATEGORY_HATE_SPEECH",       threshold: "BLOCK_NONE" },
      { category: "HARM_CATEGORY_DANGEROUS_CONTENT", threshold: "BLOCK_NONE" },
      { category: "HARM_CATEGORY_SEXUALLY_EXPLICIT", threshold: "BLOCK_NONE" },
      { category: "HARM_CATEGORY_HARASSMENT",        threshold: "BLOCK_NONE" },
    ],
  }

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  })

  const data = await res.json()
  if (!res.ok) throw new Error(`Google API error ${res.status}: ${JSON.stringify(data)}`)
  return data
}

export async function POST(req: Request) {
  try {
    const { recordId } = await req.json()
    if (!recordId) return apiError("recordId required", 400)

    const record = await prisma.record.findUnique({
      where: { id: recordId },
      include: { table: { include: { fields: true } } },
    })
    if (!record) return apiError("Record not found", 404)

    const fields = record.table.fields
    const data = JSON.parse(record.data) as Record<string, CellValue>

    const imagesField = fields.find((f) => f.name === "Images")
    const imageUrls: string[] = imagesField && Array.isArray(data[imagesField.id])
      ? (data[imagesField.id] as string[])
      : []

    if (imageUrls.length === 0) return apiError("No images attached", 400)

    // Load images from disk and encode to base64
    const imageParts = await Promise.all(
      imageUrls.map(async (url) => {
        const buffer = await readFile(join(process.cwd(), "public", url))
        return {
          inline_data: {
            mime_type: getMimeType(url),
            data: buffer.toString("base64"),
          },
        }
      })
    )

    const result = await callGoogleAPI(imageParts, PROMPT)
    const text: string = result.candidates?.[0]?.content?.parts?.[0]?.text ?? ""
    const generated = JSON.parse(text) as { title: string; description: string; tags: string[] }

    // Resolve Tags field — find or create options for each generated tag
    const tagsField = fields.find((f) => f.name === "Tags")
    const titleField = fields.find((f) => f.name === "Title")
    const descField = fields.find((f) => f.name === "Description")

    const fieldUpdates: Record<string, CellValue> = {}

    if (titleField) fieldUpdates[titleField.id] = generated.title
    if (descField) fieldUpdates[descField.id] = generated.description

    let updatedTagsField = null
    if (tagsField) {
      const tagsConfig = JSON.parse(tagsField.config) as { options?: Array<{ id: string; label: string; color: string }> }
      const existingOptions = tagsConfig.options ?? []
      const newOptions = [...existingOptions]
      const tagOptionIds: string[] = []

      for (const tag of generated.tags) {
        const match = existingOptions.find((o) => o.label.toLowerCase() === tag.toLowerCase())
        if (match) {
          tagOptionIds.push(match.id)
        } else {
          const newOpt = { id: randomUUID(), label: tag, color: "#a3a3a3" }
          newOptions.push(newOpt)
          tagOptionIds.push(newOpt.id)
        }
      }

      await prisma.field.update({
        where: { id: tagsField.id },
        data: { config: JSON.stringify({ ...tagsConfig, options: newOptions }) },
      })

      fieldUpdates[tagsField.id] = tagOptionIds
      updatedTagsField = { ...tagsField, config: { ...tagsConfig, options: newOptions } }
    }

    // Patch the record
    await prisma.record.update({
      where: { id: recordId },
      data: { data: JSON.stringify({ ...data, ...fieldUpdates }) },
    })

    return NextResponse.json({
      title: generated.title,
      description: generated.description,
      tags: generated.tags,
      fieldUpdates,
      updatedFields: updatedTagsField ? [updatedTagsField] : [],
    })
  } catch (err) {
    console.error("AI generate error:", err)
    return handleApiError(err)
  }
}
