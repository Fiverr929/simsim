# Listing Creator — Plan 2: Automation Engine

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Wire up the automation engine so clicking Run on selected rows calls the AI pipeline (detect → generate → post-process) and streams field updates live into the grid.

**Architecture:** Client-side orchestration — the UI loops through rows in batches, calling a new `POST /api/automation/run-row` endpoint per row. The endpoint builds a dynamic prompt from the category's ListingSettings config, calls Google Gemini, applies post-process rules, writes results to DB, and returns field updates. The client applies updates immediately to local state (live cell updates, no page refresh). An `AutomationToolbar` above the grid provides Run/Stop/Retry controls and a progress counter. A new `patchLocalRecord` hook avoids double-writes.

**Tech Stack:** Next.js App Router, React 19, TypeScript, Prisma/SQLite, Tailwind CSS v4, lucide-react, Google Gemini 2.5 Flash (existing GOOGLE_API_KEY).

---

## File Map

**New files:**
- `app/api/automation/run-row/route.ts` — full per-row pipeline (generate + post-process + DB write)
- `components/table/AutomationToolbar.tsx` — Run / Stop / Retry / progress bar (Etsy only)

**Modified files:**
- `app/api/listing-settings/[baseId]/route.ts` — PATCH syncs Category field options when categories change
- `hooks/useRecords.ts` — add `patchLocalRecord` (local-state update, no API call)
- `components/table/DynamicGrid.tsx` — expose `onSelectionChange` prop
- `components/table/TableView.tsx` — integrate AutomationToolbar + run loop + abort

---

## Task 1: Sync Category field options on settings save

**Files:**
- Modify: `app/api/listing-settings/[baseId]/route.ts`

When categories are updated, the Category singleSelect field in every table of the base needs matching options so the grid dropdown works. Option IDs equal `ListingCategory.id` so the automation engine can resolve the category directly.

- [ ] **Step 1: Extend the PATCH route**

Replace `app/api/listing-settings/[baseId]/route.ts` with:

```typescript
import { NextResponse } from "next/server"
import { prisma } from "@/lib/db"
import { handleApiError, apiError } from "@/lib/api"
import { emptySettings } from "@/types/listing-settings"
import type { ListingSettings } from "@/types/listing-settings"
import type { BaseConfig } from "@/types/core"

export async function GET(_req: Request, { params }: { params: Promise<{ baseId: string }> }) {
  try {
    const { baseId } = await params
    const base = await prisma.base.findUnique({ where: { id: baseId } })
    if (!base) return apiError("Base not found", 404)
    const config = JSON.parse(base.config) as BaseConfig
    return NextResponse.json(config.listingSettings ?? emptySettings())
  } catch (err) {
    return handleApiError(err)
  }
}

export async function PATCH(req: Request, { params }: { params: Promise<{ baseId: string }> }) {
  try {
    const { baseId } = await params
    const settings: Partial<ListingSettings> = await req.json()
    const base = await prisma.base.findUnique({ where: { id: baseId } })
    if (!base) return apiError("Base not found", 404)
    const config = JSON.parse(base.config) as BaseConfig
    const merged: BaseConfig = {
      ...config,
      listingSettings: { ...(config.listingSettings ?? emptySettings()), ...settings },
    }
    await prisma.base.update({ where: { id: baseId }, data: { config: JSON.stringify(merged) } })

    // Sync Category field options whenever categories change
    if (settings.categories !== undefined) {
      const categoryOptions = merged.listingSettings!.categories.map((c) => ({
        id: c.id,
        label: c.name,
        color: c.color,
      }))
      const tables = await prisma.table.findMany({
        where: { baseId },
        include: { fields: { where: { name: "Category" } } },
      })
      for (const table of tables) {
        for (const field of table.fields) {
          const existing = JSON.parse(field.config) as Record<string, unknown>
          await prisma.field.update({
            where: { id: field.id },
            data: { config: JSON.stringify({ ...existing, options: categoryOptions }) },
          })
        }
      }
    }

    return NextResponse.json(merged.listingSettings)
  } catch (err) {
    return handleApiError(err)
  }
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd "C:\Users\This PC\Gravity\SIDE APPS\workstation" && npx tsc --noEmit 2>&1
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add app/api/listing-settings/[baseId]/route.ts
git commit -m "feat(settings): sync Category field options when categories are saved"
```

---

## Task 2: Automation run-row API

**Files:**
- Create: `app/api/automation/run-row/route.ts`

Accepts `{ recordId, baseId }`. Loads the record's category from ListingSettings, builds a dynamic prompt, calls Google Gemini, applies post-process rules, writes results to DB, returns `fieldUpdates`.

The Automation State field uses option IDs (not labels): `"idle"`, `"queued"`, `"generating"`, `"review"`, `"published"`, `"error"` — these match the seed option IDs exactly.

- [ ] **Step 1: Create `app/api/automation/run-row/route.ts`**

```typescript
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
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd "C:\Users\This PC\Gravity\SIDE APPS\workstation" && npx tsc --noEmit 2>&1
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add app/api/automation/run-row/route.ts
git commit -m "feat(automation): add run-row API — dynamic prompt, post-process, DB write"
```

---

## Task 3: patchLocalRecord hook

**Files:**
- Modify: `hooks/useRecords.ts`

Adds `patchLocalRecord(id, data)` — updates React state only, no PATCH call. Used by the automation loop to apply AI results instantly after the API responds (the API already wrote to DB, so no redundant PATCH needed).

- [ ] **Step 1: Add `patchLocalRecord` to `hooks/useRecords.ts`**

Add this function before the `return` statement:

```typescript
const patchLocalRecord = useCallback((id: string, data: Record<string, CellValue>) => {
  setRecords((p) => p.map((r) => r.id === id ? { ...r, data: { ...r.data, ...data } } : r))
}, [])
```

Update the return object to include it:

```typescript
return { records, loading, addRecord, updateRecord, deleteRecord, deleteRecords, patchLocalRecord, refetch: () => tableId && fetchRecords(tableId) }
```

- [ ] **Step 2: Verify TypeScript**

```bash
cd "C:\Users\This PC\Gravity\SIDE APPS\workstation" && npx tsc --noEmit 2>&1
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add hooks/useRecords.ts
git commit -m "feat(hooks): add patchLocalRecord for optimistic live cell updates"
```

---

## Task 4: AutomationToolbar component

**Files:**
- Create: `components/table/AutomationToolbar.tsx`

Appears above the grid only for Etsy integration tables. Shows Run / Stop / Retry buttons and a live progress counter.

- [ ] **Step 1: Create `components/table/AutomationToolbar.tsx`**

```tsx
"use client"

import { Play, Square, RotateCcw, Loader2 } from "lucide-react"
import { cn } from "@/lib/utils"
import type { AppRecord, Field } from "@/types/core"

interface Props {
  records: AppRecord[]
  fields: Field[]
  selectedRecordIds: string[]
  running: boolean
  progress: { done: number; total: number } | null
  onRun: (recordIds: string[]) => void
  onStop: () => void
  onRetry: () => void
}

export function AutomationToolbar({
  records, fields, selectedRecordIds, running, progress, onRun, onStop, onRetry,
}: Props) {
  const automationStateField = fields.find((f) => f.name === "Automation State")

  const pendingIds = automationStateField
    ? records
        .filter((r) => {
          const state = r.data[automationStateField.id]
          return state == null || state === "idle"
        })
        .map((r) => r.id)
    : []

  const errorIds = automationStateField
    ? records.filter((r) => r.data[automationStateField.id] === "error").map((r) => r.id)
    : []

  const hasSelected = selectedRecordIds.length > 0
  const runTarget = hasSelected ? selectedRecordIds : pendingIds

  return (
    <div className="flex items-center gap-2 px-3 py-1 bg-orange-50 border-b border-orange-100 shrink-0">
      <span className="text-[10px] font-semibold uppercase tracking-wider text-orange-400 mr-1 select-none">
        Automation
      </span>

      {running ? (
        <>
          <div className="flex items-center gap-1.5 text-xs text-orange-600 select-none">
            <Loader2 size={12} className="animate-spin shrink-0" />
            {progress ? `Generating ${progress.done} / ${progress.total}…` : "Running…"}
          </div>
          <button
            onClick={onStop}
            className="ml-1 flex items-center gap-1 px-2.5 py-0.5 text-xs text-red-600 bg-white hover:bg-red-50 rounded border border-red-200 transition-colors"
          >
            <Square size={11} /> Stop
          </button>
        </>
      ) : (
        <>
          <button
            onClick={() => onRun(runTarget)}
            disabled={runTarget.length === 0}
            className={cn(
              "flex items-center gap-1 px-2.5 py-0.5 text-xs rounded border transition-colors",
              runTarget.length > 0
                ? "text-orange-600 bg-white hover:bg-orange-50 border-orange-200"
                : "text-neutral-300 bg-white border-neutral-200 cursor-not-allowed"
            )}
          >
            <Play size={11} />
            {hasSelected
              ? `Run selected (${selectedRecordIds.length})`
              : pendingIds.length > 0
              ? `Run pending (${pendingIds.length})`
              : "No pending rows"}
          </button>

          {errorIds.length > 0 && (
            <button
              onClick={onRetry}
              className="flex items-center gap-1 px-2.5 py-0.5 text-xs text-red-600 bg-white hover:bg-red-50 rounded border border-red-200 transition-colors"
            >
              <RotateCcw size={11} /> Retry errors ({errorIds.length})
            </button>
          )}
        </>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Verify TypeScript**

```bash
cd "C:\Users\This PC\Gravity\SIDE APPS\workstation" && npx tsc --noEmit 2>&1
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add components/table/AutomationToolbar.tsx
git commit -m "feat(automation): add AutomationToolbar with Run/Stop/Retry and progress counter"
```

---

## Task 5: DynamicGrid — expose selected record IDs

**Files:**
- Modify: `components/table/DynamicGrid.tsx`

The automation toolbar needs to know which rows are selected. DynamicGrid has internal `gridSelection` state (Glide Data Grid). Add an `onSelectionChange` prop that fires with selected record IDs whenever selection changes.

- [ ] **Step 1: Add `onSelectionChange` prop to the `Props` interface**

In `components/table/DynamicGrid.tsx`, find the `interface Props {` block and add one line:

```typescript
onSelectionChange?: (recordIds: string[]) => void
```

- [ ] **Step 2: Destructure the new prop in the function signature**

Find `export function DynamicGrid({` and add `onSelectionChange` to the destructured props:

```typescript
export function DynamicGrid({
  fields, records, hiddenFieldIds = [], rowHeight = 34, colorFieldId,
  onRecordUpdate, onRecordAdd, onRecordDelete, onRecordsDelete, onRecordsReorder, onRecordExpand, onAddField,
  onFieldRename, onFieldTypeChange, onFieldDelete, onFieldsDelete, onFieldHide, onFieldConfigUpdate,
  fieldOrder, onFieldOrderChange, onSelectionChange,
}: Props) {
```

- [ ] **Step 3: Replace the `onGridSelectionChange` handler**

Find this line in the component body:
```typescript
onGridSelectionChange={setGridSelection}
```

Replace it with a handler that fires the new prop:
```typescript
onGridSelectionChange={(sel) => {
  setGridSelection(sel)
  if (onSelectionChange) {
    const ids = sel.rows.toArray().map((i) => records[i]?.id).filter((id): id is string => Boolean(id))
    onSelectionChange(ids)
  }
}}
```

- [ ] **Step 4: Verify TypeScript**

```bash
cd "C:\Users\This PC\Gravity\SIDE APPS\workstation" && npx tsc --noEmit 2>&1
```

Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add components/table/DynamicGrid.tsx
git commit -m "feat(grid): expose onSelectionChange prop for selected record IDs"
```

---

## Task 6: TableView — automation wiring

**Files:**
- Modify: `components/table/TableView.tsx`

Integrate `AutomationToolbar`, track selected rows, and implement the `runAutomation` loop with abort support.

- [ ] **Step 1: Add imports and new state at the top of `TableView`**

Add these imports at the top of `components/table/TableView.tsx` (after existing imports):

```typescript
import { useRef } from "react"
import { AutomationToolbar } from "@/components/table/AutomationToolbar"
```

Note: `useRef` is likely already imported — if so, skip that part. Check the existing import line and merge.

Inside the `TableView` function, after the existing state declarations, add:

```typescript
const [selectedRecordIds, setSelectedRecordIds] = useState<string[]>([])
const [automationRunning, setAutomationRunning] = useState(false)
const [automationProgress, setAutomationProgress] = useState<{ done: number; total: number } | null>(null)
const abortRef = useRef(false)
```

- [ ] **Step 2: Destructure `patchLocalRecord` from `useRecords`**

Find the line:
```typescript
const { records, addRecord, updateRecord, deleteRecord, deleteRecords } = useRecords(activeTableId)
```

Replace with:
```typescript
const { records, addRecord, updateRecord, deleteRecord, deleteRecords, patchLocalRecord } = useRecords(activeTableId)
```

- [ ] **Step 3: Add the `runAutomation` function**

Add this function inside `TableView`, after the existing callback definitions (after `handleFieldConfigUpdate`):

```typescript
const runAutomation = useCallback(async (recordIds: string[]) => {
  if (!activeBaseId || automationRunning) return

  // Load settings to get batchSize
  let batchSize = 10
  try {
    const res = await fetch(`/api/listing-settings/${activeBaseId}`)
    if (res.ok) {
      const s = await res.json()
      batchSize = s.batchSize ?? 10
    }
  } catch { /* use default */ }

  const batch = recordIds.slice(0, batchSize)
  const automationStateField = fields.find((f) => f.name === "Automation State")

  setAutomationRunning(true)
  abortRef.current = false
  setAutomationProgress({ done: 0, total: batch.length })

  // Mark batch as queued
  if (automationStateField) {
    for (const id of batch) {
      patchLocalRecord(id, { [automationStateField.id]: "queued" })
    }
  }

  let done = 0
  for (const recordId of batch) {
    if (abortRef.current) break

    // Mark as generating
    if (automationStateField) {
      patchLocalRecord(recordId, { [automationStateField.id]: "generating" })
      await updateRecord(recordId, { [automationStateField.id]: "generating" })
    }

    try {
      const res = await fetch("/api/automation/run-row", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ recordId, baseId: activeBaseId }),
      })

      if (res.ok) {
        const { fieldUpdates } = await res.json()
        patchLocalRecord(recordId, fieldUpdates)
      } else {
        if (automationStateField) {
          patchLocalRecord(recordId, { [automationStateField.id]: "error" })
          await updateRecord(recordId, { [automationStateField.id]: "error" })
        }
      }
    } catch {
      if (automationStateField) {
        patchLocalRecord(recordId, { [automationStateField.id]: "error" })
        await updateRecord(recordId, { [automationStateField.id]: "error" })
      }
    }

    done++
    setAutomationProgress({ done, total: batch.length })
  }

  setAutomationRunning(false)
  setAutomationProgress(null)
}, [activeBaseId, automationRunning, fields, patchLocalRecord, updateRecord])

const retryErrors = useCallback(() => {
  const automationStateField = fields.find((f) => f.name === "Automation State")
  if (!automationStateField) return
  const errorIds = records
    .filter((r) => r.data[automationStateField.id] === "error")
    .map((r) => r.id)
  if (errorIds.length > 0) runAutomation(errorIds)
}, [fields, records, runAutomation])
```

- [ ] **Step 4: Reset selection when table changes**

Find the `useEffect` that resets state on `activeTableId` change (the one that sets `setShowSettings(false)`). Add resets for the new state:

```typescript
useEffect(() => { setShowSettings(false) }, [activeTableId])
// Add this adjacent effect:
useEffect(() => {
  setSelectedRecordIds([])
  setAutomationRunning(false)
  setAutomationProgress(null)
  abortRef.current = false
}, [activeTableId])
```

- [ ] **Step 5: Add AutomationToolbar and onSelectionChange to the grid view JSX**

Find the section where `<Toolbar ...>` is rendered (inside `{showSettings && activeBaseId ? ... : <>...`). Inside the `<>` (non-settings view), add the AutomationToolbar **between** `<Toolbar>` and the view content (grid/gallery/kanban).

The section looks like:
```tsx
{showSettings && activeBaseId ? (
  <ListingSettingsPanel ... />
) : (
  <>
    <ViewTabs ... />
    <Toolbar ... />
    {/* grid / gallery / kanban views */}
  </>
)}
```

Add `AutomationToolbar` after `<Toolbar>`:

```tsx
{showSettings && activeBaseId ? (
  <ListingSettingsPanel ... />
) : (
  <>
    <ViewTabs ... />
    <Toolbar ... />
    {activeBaseIntegration === "etsy" && (
      <AutomationToolbar
        records={displayRecords}
        fields={fields}
        selectedRecordIds={selectedRecordIds}
        running={automationRunning}
        progress={automationProgress}
        onRun={runAutomation}
        onStop={() => { abortRef.current = true }}
        onRetry={retryErrors}
      />
    )}
    {/* ... existing grid/gallery/kanban ... */}
  </>
)}
```

- [ ] **Step 6: Pass `onSelectionChange` to `DynamicGrid`**

Find the `<DynamicGrid` render in the `viewType === "grid"` branch. Add the new prop:

```tsx
<DynamicGrid
  {/* ...all existing props... */}
  onSelectionChange={activeBaseIntegration === "etsy" ? setSelectedRecordIds : undefined}
/>
```

- [ ] **Step 7: Verify TypeScript**

```bash
cd "C:\Users\This PC\Gravity\SIDE APPS\workstation" && npx tsc --noEmit 2>&1
```

Fix any errors. Common issues:
- `patchLocalRecord` not in useRecords return — verify Task 3 is done
- `abortRef` type error — ensure `useRef` import is present (it's already imported)

- [ ] **Step 8: Commit**

```bash
git add components/table/TableView.tsx
git commit -m "feat(automation): wire AutomationToolbar with run loop, abort, and live cell updates"
```

---

## Task 7: End-to-end verification

- [ ] **Step 1: TypeScript clean build**

```bash
cd "C:\Users\This PC\Gravity\SIDE APPS\workstation" && npx tsc --noEmit 2>&1
```

Expected: 0 errors.

- [ ] **Step 2: Next.js build**

```bash
cd "C:\Users\This PC\Gravity\SIDE APPS\workstation" && npx next build 2>&1 | head -60
```

Expected: successful compile with the new routes listed.

- [ ] **Step 3: Manual walkthrough** (with dev server running)

1. Create a Space → seed an Etsy Store
2. Open Listing Settings → Categories → create a "Digital Wall Art" category
   - Identity: name, icon, color, default price $4.99
   - Trigger: "When Images is filled"
   - Fields: set Images = Trigger+Context, Title = Context, Description = Generated, Tags = Generated, Price = Default
3. Verify the Category singleSelect column in the grid now has "Digital Wall Art" as an option
4. Add a new row (click "+ New Listing" in sidebar or "+ New record" in grid)
5. Attach an image to the Images cell
6. Set the Category cell to "Digital Wall Art"
7. The AutomationToolbar should appear above the grid (orange bar)
8. Click **"Run pending (1)"** — row state changes to "queued" then "generating"
9. After a few seconds, Title, Description, Tags cells fill in with AI-generated content
10. Automation State shows "review"
11. Select 2 rows → toolbar button says **"Run selected (2)"** — click it, both rows generate
12. Click **Stop** mid-run — loop halts cleanly after current row
13. Force an error: disconnect network, run again → row shows "error" state
14. Reconnect → click **"Retry errors (1)"** — row re-runs

- [ ] **Step 4: Final commit**

```bash
git add -A
git commit -m "feat: automation engine complete — run loop, live cell updates, stop/retry, progress bar"
```

---

## What's Next

**Plan 3 (future)** covers:
- Auto-detect category from image (AI classify step 0, calls Gemini with category list)
- Streaming cell updates (SSE endpoint so Title/Tags appear word-by-word)
- Publish integration in the toolbar (after review state, one-click publish to Etsy)
- Scheduling: run automation at a specific time ("generate 10 listings every morning")
