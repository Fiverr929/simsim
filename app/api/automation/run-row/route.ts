import { NextResponse } from "next/server"
import { readFile } from "fs/promises"
import { join } from "path"
import { randomUUID } from "crypto"
import { prisma } from "@/lib/db"
import { handleApiError, apiError } from "@/lib/api"
import { emptySettings } from "@/types/listing-settings"
import type { ListingCategory, PostProcessRule, DescriptionBlock } from "@/types/listing-settings"
import type { BaseConfig, CellValue } from "@/types/core"

const MODEL = "gemini-2.5-flash"

const DEFAULT_PROMPT = `You are an expert Etsy seller specializing in digital products. Analyze the product image(s) and return ONLY valid JSON — no markdown, no explanation:
{
  "Title": "keyword-rich title, max 140 chars, lead with the most important keyword",
  "Description": "3-5 paragraphs, weave in SEO keywords naturally, conversational tone",
  "Tags": ["tag1", "tag2", "tag3", "tag4", "tag5", "tag6", "tag7", "tag8", "tag9", "tag10", "tag11", "tag12", "tag13"]
}
Tags: exactly 13, max 20 chars each, lowercase, most relevant first.`

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

  const url = `https://aiplatform.googleapis.com/v1/publishers/google/models/${MODEL}:generateContent?key=${apiKey}`
  const res = await fetch(url, {
    method: "POST",
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

function buildDescriptionFromBlocks(
  blocks: DescriptionBlock[],
  contextValues: Record<string, string>
): string {
  // Returns prompt instructions for the description section when blocks are defined
  return blocks.map((block, i) => {
    if (block.type === "fixed") return `[Block ${i + 1} — verbatim, include exactly]: ${block.content}`
    if (block.type === "ai") return `[Block ${i + 1} — write this]: ${block.content}`
    const varKey = block.content.replace(/[{}]/g, "").trim()
    return `[Block ${i + 1} — use this value]: ${contextValues[varKey] ?? ""}`
  }).join("\n")
}

function buildPrompt(
  category: ListingCategory | null,
  contextValues: Record<string, string>
): string {
  if (!category?.templateOverride) return DEFAULT_PROMPT

  let prompt = category.templateOverride
  // Replace template variables
  for (const [key, value] of Object.entries(contextValues)) {
    prompt = prompt.replace(new RegExp(`\\{\\{${key}\\}\\}`, "g"), value)
  }

  // Append description block instructions if defined
  if (category.descriptionBlocks.length > 0) {
    const blockInstructions = buildDescriptionFromBlocks(category.descriptionBlocks, contextValues)
    prompt += `\n\nFor the "Description" field, compose it from these ordered blocks (separate with \\n\\n):\n${blockInstructions}`
  }

  return prompt
}

function applyTagRules(tags: string[], rules: PostProcessRule[]): string[] {
  let result = [...tags]
  for (const rule of rules.filter((r) => r.fieldName === "Tags")) {
    if (rule.type === "append_tags") {
      const toAdd = rule.value.split(",").map((t) => t.trim()).filter(Boolean)
      for (const tag of toAdd) {
        if (!result.some((t) => t.toLowerCase() === tag.toLowerCase())) result.push(tag)
      }
    } else if (rule.type === "exclude_tags") {
      const toExclude = new Set(rule.value.split(",").map((t) => t.trim().toLowerCase()))
      result = result.filter((t) => !toExclude.has(t.toLowerCase()))
    }
  }
  return result.slice(0, 13)
}

function applyStringRules(fieldName: string, value: string, rules: PostProcessRule[]): string {
  let result = value
  for (const rule of rules.filter((r) => r.fieldName === fieldName)) {
    if (rule.type === "max_chars") result = result.slice(0, Number(rule.value))
    else if (rule.type === "capitalize_first") result = result.charAt(0).toUpperCase() + result.slice(1)
    else if (rule.type === "regex_replace") {
      try { result = result.replace(new RegExp(rule.value, "g"), rule.replacement ?? "") } catch { /* skip invalid regex */ }
    }
  }
  return result
}

export async function POST(req: Request) {
  try {
    const { recordId, baseId } = await req.json()
    if (!recordId || !baseId) return apiError("recordId and baseId required", 400)

    // Load record + fields
    const record = await prisma.record.findUnique({
      where: { id: recordId },
      include: { table: { include: { fields: true } } },
    })
    if (!record) return apiError("Record not found", 404)

    // Load base settings
    const base = await prisma.base.findUnique({ where: { id: baseId } })
    if (!base) return apiError("Base not found", 404)
    const baseConfig = JSON.parse(base.config) as BaseConfig
    const settings = baseConfig.listingSettings ?? emptySettings()

    const fields = record.table.fields
    const data = JSON.parse(record.data) as Record<string, CellValue>
    const fieldByName = Object.fromEntries(fields.map((f) => [f.name, f]))
    const get = (name: string): CellValue => data[fieldByName[name]?.id ?? ""] ?? null

    // Resolve category (option ID in Category field = ListingCategory.id)
    const categoryValue = get("Category") as string | null
    const category = categoryValue ? settings.categories.find((c) => c.id === categoryValue) ?? null : null

    // Get image URLs
    const imagesField = fieldByName["Images"]
    const imageUrls: string[] = imagesField && Array.isArray(data[imagesField.id])
      ? (data[imagesField.id] as string[])
      : []
    if (imageUrls.length === 0) return apiError("No images attached", 400)

    // Load images as base64
    const imageParts = await Promise.all(
      imageUrls.map(async (url) => {
        const buffer = await readFile(join(process.cwd(), "public", url))
        return { inline_data: { mime_type: getMimeType(url), data: buffer.toString("base64") } }
      })
    )

    // Collect context values (for template variable substitution)
    const contextValues: Record<string, string> = {
      category_name: category?.name ?? "",
      image_analysis: "",
      style_tags: "",
      shop_section: "",
    }
    const titleHint = get("Title")
    if (titleHint) contextValues.title_hint = String(titleHint)
    if (category) {
      for (const fc of category.fieldRoles.filter((r) => r.roles.includes("context"))) {
        const v = get(fc.fieldName)
        if (v != null) contextValues[fc.fieldName.toLowerCase().replace(/\s+/g, "_")] = String(v)
      }
    }

    // Build prompt and call AI
    const prompt = buildPrompt(category, contextValues)
    const text = await callGemini(imageParts, prompt)

    let generated: Record<string, unknown> = {}
    try {
      generated = JSON.parse(text)
    } catch {
      return apiError("AI returned invalid JSON", 500)
    }

    // Build field updates
    const fieldUpdates: Record<string, CellValue> = {}
    const postProcessRules = category?.postProcessRules ?? []

    for (const [key, value] of Object.entries(generated)) {
      const field = fieldByName[key]
      if (!field) continue

      if (field.type === "multiSelect" && Array.isArray(value)) {
        // Apply tag post-process rules before resolving to option IDs
        let tagStrings = (value as unknown[]).map(String)
        if (key === "Tags") tagStrings = applyTagRules(tagStrings, postProcessRules)

        const config = JSON.parse(field.config) as { options?: Array<{ id: string; label: string; color: string }> }
        const existingOptions = config.options ?? []
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
          data: { config: JSON.stringify({ ...config, options: allOptions }) },
        })
        fieldUpdates[field.id] = tagIds
      } else if (typeof value === "string") {
        fieldUpdates[field.id] = applyStringRules(field.name, value, postProcessRules)
      } else {
        fieldUpdates[field.id] = value as CellValue
      }
    }

    // Apply default-role fields from category (only if not already generated)
    if (category) {
      for (const fc of category.fieldRoles.filter((r) => r.roles.includes("default"))) {
        const field = fieldByName[fc.fieldName]
        if (field && fc.defaultValue != null && !(field.id in fieldUpdates)) {
          fieldUpdates[field.id] = fc.defaultValue as CellValue
        }
      }
    }
    // Apply store-level field defaults
    for (const [fieldName, defaultValue] of Object.entries(settings.fieldDefaults)) {
      const field = fieldByName[fieldName]
      if (field && defaultValue != null && !(field.id in fieldUpdates)) {
        fieldUpdates[field.id] = defaultValue as CellValue
      }
    }

    // Set automation state and timestamp
    const automationStateField = fieldByName["Automation State"]
    const lastGeneratedField = fieldByName["Last Generated At"]
    if (automationStateField) {
      fieldUpdates[automationStateField.id] = (category?.autoPublish) ? "published" : "review"
    }
    if (lastGeneratedField) {
      fieldUpdates[lastGeneratedField.id] = new Date().toISOString()
    }

    // Write to DB
    await prisma.record.update({
      where: { id: recordId },
      data: { data: JSON.stringify({ ...data, ...fieldUpdates }) },
    })

    return NextResponse.json({ fieldUpdates })
  } catch (err) {
    console.error("Automation run-row error:", err)
    return handleApiError(err)
  }
}
