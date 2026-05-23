import { NextResponse } from "next/server"
import { readFile } from "fs/promises"
import { resolve, sep } from "path"
import { randomUUID } from "crypto"
import { prisma } from "@/lib/db"
import { handleApiError, apiError } from "@/lib/api"
import type { BaseConfig, CellValue, Field } from "@/types/core"
import type { Automation, GenerateAIAction } from "@/types/automation"

const MODEL = "gemini-2.5-flash"

function getMimeType(url: string): string {
  const ext = url.split(".").pop()?.toLowerCase()
  if (ext === "png") return "image/png"
  if (ext === "webp") return "image/webp"
  if (ext === "gif") return "image/gif"
  return "image/jpeg"
}

async function callGemini(
  imageParts: Array<{ inline_data: { mime_type: string; data: string } }>,
  prompt: string
): Promise<string> {
  const apiKey = process.env.GOOGLE_API_KEY
  if (!apiKey) throw new Error("GOOGLE_API_KEY not set")
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${apiKey}`
  const res = await fetch(url, {
    method: "POST",
    signal: AbortSignal.timeout(25_000),
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ role: "user", parts: [...imageParts, { text: prompt }] }],
      generationConfig: { responseMimeType: "application/json" },
      safetySettings: [
        { category: "HARM_CATEGORY_HATE_SPEECH", threshold: "BLOCK_NONE" },
        { category: "HARM_CATEGORY_DANGEROUS_CONTENT", threshold: "BLOCK_NONE" },
        { category: "HARM_CATEGORY_SEXUALLY_EXPLICIT", threshold: "BLOCK_NONE" },
        { category: "HARM_CATEGORY_HARASSMENT", threshold: "BLOCK_NONE" },
      ],
    }),
  })
  const data = await res.json()
  if (!res.ok) throw new Error(`Gemini API error ${res.status}: ${JSON.stringify(data)}`)
  return data.candidates?.[0]?.content?.parts?.[0]?.text ?? ""
}

/** Replace {{FieldName}} tokens with the row's value for that field */
function buildPrompt(
  prompt: string,
  rowData: Record<string, CellValue>,
  fieldByName: Record<string, Field>
): string {
  return prompt.replace(/\{\{([^}]+)\}\}/g, (_, fieldName: string) => {
    const field = fieldByName[fieldName.trim()]
    if (!field) return ""
    const value = rowData[field.id]
    if (Array.isArray(value)) return value.join(", ")
    return value != null ? String(value) : ""
  })
}

/** Find the automation that matches this row (by filter or first active fallback) */
function resolveAutomation(
  automations: Automation[],
  rowData: Record<string, CellValue>,
  fieldByName: Record<string, Field>
): Automation | null {
  const active = automations.filter((a) => a.active)
  if (active.length === 0) return null

  // Try filter match first
  for (const a of active) {
    if (!a.filter) continue
    const field = fieldByName[a.filter.fieldName]
    if (!field) continue
    const cellValue = rowData[field.id]
    // field.config is stored as JSON string in Prisma; cast via unknown
    const fieldConfig = (typeof field.config === "string"
      ? JSON.parse(field.config)
      : field.config) as { options?: Array<{ id: string; label: string }> }
    const option = fieldConfig.options?.find((o) => o.id === cellValue || o.label === cellValue)
    if (option?.label === a.filter.value || cellValue === a.filter.value) return a
  }

  // Fallback: first active automation with no filter
  return active.find((a) => !a.filter) ?? active[0]
}

export async function POST(req: Request) {
  try {
    let body: { recordId?: unknown; baseId?: unknown }
    try { body = await req.json() } catch { return apiError("Invalid request body", 400) }
    const { recordId, baseId } = body
    if (typeof recordId !== "string" || typeof baseId !== "string") {
      return apiError("recordId and baseId required", 400)
    }

    const record = await prisma.record.findUnique({
      where: { id: recordId },
      include: { table: { include: { fields: true } } },
    })
    if (!record) return apiError("Record not found", 404)

    const base = await prisma.base.findUnique({ where: { id: baseId } })
    if (!base) return apiError("Base not found", 404)
    if (record.table.baseId !== baseId) return apiError("Record not found", 404)

    const config = JSON.parse(base.config) as BaseConfig
    const automations = config.automations ?? []

    const fields = record.table.fields as unknown as Field[]
    const data = JSON.parse(record.data) as Record<string, CellValue>
    const fieldByName = Object.fromEntries(fields.map((f) => [f.name, f]))

    const automation = resolveAutomation(automations, data, fieldByName)
    if (!automation) return apiError("No active automation found for this base", 400)

    // Load images
    const imagesField = fieldByName["Images"]
    const imageUrls: string[] = imagesField && Array.isArray(data[imagesField.id])
      ? (data[imagesField.id] as string[]).filter((u): u is string => typeof u === "string")
      : []
    if (imageUrls.length === 0) return apiError("No images attached", 400)

    const publicDir = resolve(process.cwd(), "public")
    let imageParts: Array<{ inline_data: { mime_type: string; data: string } }>
    try {
      imageParts = await Promise.all(
        imageUrls.map(async (url) => {
          const target = resolve(publicDir, url.startsWith("/") ? url.slice(1) : url)
          if (!target.startsWith(publicDir + sep)) throw new Error(`Invalid image path: ${url}`)
          const buffer = await readFile(target)
          return { inline_data: { mime_type: getMimeType(url), data: buffer.toString("base64") } }
        })
      )
    } catch (err) {
      return apiError(`Could not read image: ${(err as Error).message}`, 400)
    }

    const fieldUpdates: Record<string, CellValue> = {}

    // Execute each action in order
    for (const action of automation?.actions ?? []) {
      if (action.type === "generate_ai") {
        const generateAction = action as GenerateAIAction
        const prompt = buildPrompt(generateAction.prompt, data, fieldByName)
        const text = await callGemini(imageParts, prompt)

        let generated: Record<string, unknown> = {}
        try { generated = JSON.parse(text) } catch { return apiError("AI returned invalid JSON", 500) }

        for (const fieldName of generateAction.writeToFields) {
          const field = fieldByName[fieldName]
          if (!field) continue
          const value = generated[fieldName]
          if (value === undefined) continue

          if (field.type === "multiSelect" && Array.isArray(value)) {
            const tagStrings = (value as unknown[]).map(String).slice(0, 13)
            const cfg = (typeof field.config === "string"
              ? JSON.parse(field.config)
              : field.config) as { options?: Array<{ id: string; label: string; color: string }> }
            const existingOptions = cfg.options ?? []
            const allOptions = [...existingOptions]
            const tagIds: string[] = []
            for (const tag of tagStrings) {
              const match = existingOptions.find((o) => o.label.toLowerCase() === tag.toLowerCase())
              if (match) {
                tagIds.push(match.id)
              } else {
                const opt = { id: randomUUID(), label: tag, color: "#a3a3a3" }
                allOptions.push(opt)
                tagIds.push(opt.id)
              }
            }
            await prisma.field.update({
              where: { id: field.id },
              data: { config: JSON.stringify({ ...cfg, options: allOptions }) },
            })
            fieldUpdates[field.id] = tagIds
          } else if (typeof value === "string") {
            fieldUpdates[field.id] = value
          } else if (typeof value === "number" || typeof value === "boolean") {
            fieldUpdates[field.id] = value
          }
        }
      }

      if (action.type === "set_field") {
        const field = fieldByName[action.fieldName]
        if (field) fieldUpdates[field.id] = action.value
      }

      // publish_etsy is handled separately via /api/etsy/publish — skip here
    }

    // Set automation state and timestamp
    const automationStateField = fieldByName["Automation State"]
    const lastGeneratedField = fieldByName["Last Generated At"]
    if (automationStateField) fieldUpdates[automationStateField.id] = "review"
    if (lastGeneratedField) fieldUpdates[lastGeneratedField.id] = new Date().toISOString()

    await prisma.record.update({
      where: { id: recordId },
      data: { data: JSON.stringify({ ...data, ...fieldUpdates }) },
    })

    return NextResponse.json({ fieldUpdates })
  } catch (err) {
    console.error("run-row error:", err)
    return handleApiError(err)
  }
}
