# Automation Simplification Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the 3-section Listing Settings panel + 5-tab CategoryEditor with a flat Automations panel where each automation is a named trigger → filter → actions chain (NocoDB/Airtable style).

**Architecture:** New `Automation` type stored in `Base.config.automations[]` (same JSON-in-config pattern, no schema change). The run-row API matches an automation by the row's filter value. The UI is a list + single scrollable editor — no tabs. Old `listing-settings` components and `types/listing-settings.ts` are deleted at the end.

**Tech Stack:** Next.js App Router, React, TypeScript, Prisma (SQLite), Tailwind, lucide-react, sonner toasts.

---

## File Map

**Create:**
- `types/automation.ts` — Automation, AutomationTrigger, AutomationAction types
- `app/api/automations/[baseId]/route.ts` — GET + PATCH automations array
- `components/automations/AutomationsPanel.tsx` — list view with on/off toggles
- `components/automations/AutomationEditor.tsx` — linear scrollable form
- `components/automations/GenerateAIAction.tsx` — generate_ai action form
- `components/automations/PublishEtsyAction.tsx` — publish_etsy action form
- `components/automations/SetFieldAction.tsx` — set_field action form

**Modify:**
- `types/core.ts` — add `automations?: Automation[]` to `BaseConfig`
- `app/api/automation/run-row/route.ts` — resolve via `Automation` instead of `ListingCategory`
- `components/table/TableView.tsx` — swap `ListingSettingsPanel` → `AutomationsPanel`

**Delete (Task 9):**
- `components/listing-settings/` (entire directory)
- `types/listing-settings.ts`

---

### Task 1: Define automation types

**Files:**
- Create: `types/automation.ts`

- [ ] **Step 1: Create the file**

```typescript
// types/automation.ts
import { v4 as uuid } from "uuid"

export type AutomationTriggerType = "field_filled" | "row_created" | "manual"

export interface AutomationTrigger {
  type: AutomationTriggerType
  fieldName?: string  // required when type === "field_filled"
}

export interface AutomationFilter {
  fieldName: string   // e.g. "Category"
  value: string       // e.g. "Art Print"
}

export interface GenerateAIAction {
  type: "generate_ai"
  prompt: string        // supports {{FieldName}} substitution
  writeToFields: string[]
}

export interface PublishEtsyAction {
  type: "publish_etsy"
  taxonomyId?: number
  shopSectionId?: number
  returnPolicyId?: number
  defaultPrice?: number
  publishState: "draft" | "active"
  requireApproval: boolean
}

export interface SetFieldAction {
  type: "set_field"
  fieldName: string
  value: string
}

export type AutomationAction = GenerateAIAction | PublishEtsyAction | SetFieldAction

export interface Automation {
  id: string
  name: string
  active: boolean
  trigger: AutomationTrigger
  filter?: AutomationFilter
  actions: AutomationAction[]
}

export function newAutomation(): Automation {
  return {
    id: uuid(),
    name: "New automation",
    active: true,
    trigger: { type: "field_filled", fieldName: "Images" },
    actions: [],
  }
}

export const DEFAULT_GENERATE_PROMPT = `You are an expert Etsy seller. Analyze the product image(s) and return ONLY valid JSON:
{
  "Title": "keyword-rich title, max 140 chars",
  "Description": "3-5 paragraphs, SEO-optimized",
  "Tags": ["tag1","tag2","tag3","tag4","tag5","tag6","tag7","tag8","tag9","tag10","tag11","tag12","tag13"]
}
Tags: exactly 13, max 20 chars each, lowercase.

Use {{FieldName}} to reference any grid column value in your prompt.`
```

- [ ] **Step 2: Commit**

```bash
git add types/automation.ts
git commit -m "feat(automation): add Automation type definitions"
```

---

### Task 2: Update BaseConfig to include automations

**Files:**
- Modify: `types/core.ts`

- [ ] **Step 1: Add import and field to BaseConfig**

In `types/core.ts`, add the import at the top and update `BaseConfig`:

```typescript
import type { ListingSettings } from "@/types/listing-settings"
import type { Automation } from "@/types/automation"   // ADD THIS

// ...existing types unchanged...

export interface BaseConfig {
  integration?: "etsy" | string
  listingSettings?: ListingSettings   // kept for migration read-only
  automations?: Automation[]           // ADD THIS
}
```

- [ ] **Step 2: Commit**

```bash
git add types/core.ts
git commit -m "feat(automation): add automations field to BaseConfig"
```

---

### Task 3: Create automations API route

**Files:**
- Create: `app/api/automations/[baseId]/route.ts`

- [ ] **Step 1: Create the route**

```typescript
// app/api/automations/[baseId]/route.ts
import { NextResponse } from "next/server"
import { prisma } from "@/lib/db"
import { handleApiError, apiError } from "@/lib/api"
import type { BaseConfig } from "@/types/core"
import type { Automation } from "@/types/automation"

export async function GET(_req: Request, { params }: { params: Promise<{ baseId: string }> }) {
  try {
    const { baseId } = await params
    const base = await prisma.base.findUnique({ where: { id: baseId } })
    if (!base) return apiError("Base not found", 404)
    const config = JSON.parse(base.config) as BaseConfig
    return NextResponse.json(config.automations ?? [])
  } catch (err) {
    return handleApiError(err)
  }
}

export async function PATCH(req: Request, { params }: { params: Promise<{ baseId: string }> }) {
  try {
    const { baseId } = await params
    const automations: Automation[] = await req.json()
    if (!Array.isArray(automations)) return apiError("Expected array of automations", 400)

    const base = await prisma.base.findUnique({ where: { id: baseId } })
    if (!base) return apiError("Base not found", 404)

    const config = JSON.parse(base.config) as BaseConfig
    const updated: BaseConfig = { ...config, automations }
    await prisma.base.update({ where: { id: baseId }, data: { config: JSON.stringify(updated) } })

    return NextResponse.json(automations)
  } catch (err) {
    return handleApiError(err)
  }
}
```

- [ ] **Step 2: Test the route**

Start the dev server (`npm run dev`) and run in a terminal:
```bash
# Replace <baseId> with a real base ID from the DB
curl http://localhost:3000/api/automations/<baseId>
```
Expected: `[]` (empty array for a new base)

- [ ] **Step 3: Commit**

```bash
git add app/api/automations/
git commit -m "feat(automation): add automations GET/PATCH API route"
```

---

### Task 4: Update run-row to use Automation model

**Files:**
- Modify: `app/api/automation/run-row/route.ts`

This replaces the `ListingCategory` / `ListingSettings` resolution with `Automation` resolution. The Gemini call and field-writing logic stays, but simplified: no field roles, no post-process rules, no description blocks.

- [ ] **Step 1: Replace the route contents**

```typescript
// app/api/automation/run-row/route.ts
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

/** Replace {{FieldName}} with the row's value for that field */
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
    // singleSelect stores option ID; compare label via field config
    const fieldConfig = JSON.parse(
      typeof field.config === "string" ? field.config : JSON.stringify(field.config)
    ) as { options?: Array<{ id: string; label: string }> }
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

    const fields = record.table.fields
    const data = JSON.parse(record.data) as Record<string, CellValue>
    const fieldByName = Object.fromEntries(fields.map((f) => [f.name, f]))
    const get = (name: string): CellValue => data[fieldByName[name]?.id ?? ""] ?? null

    const automation = resolveAutomation(automations, data, fieldByName)

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
            const rawConfig = typeof field.config === "string" ? field.config : JSON.stringify(field.config)
            const config = JSON.parse(rawConfig) as { options?: Array<{ id: string; label: string; color: string }> }
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
```

- [ ] **Step 2: Test by running an existing automation**

Open the app, navigate to an Etsy base with an image row, click Run — confirm the row generates content and Automation State updates to "review".

- [ ] **Step 3: Commit**

```bash
git add app/api/automation/run-row/route.ts
git commit -m "feat(automation): run-row resolves Automation instead of ListingCategory"
```

---

### Task 5: Create AutomationsPanel (list view)

**Files:**
- Create: `components/automations/AutomationsPanel.tsx`

- [ ] **Step 1: Create the component**

```typescript
// components/automations/AutomationsPanel.tsx
"use client"

import { useCallback, useEffect, useState } from "react"
import { Plus, X, Zap } from "lucide-react"
import { toast } from "sonner"
import { cn } from "@/lib/utils"
import { newAutomation } from "@/types/automation"
import type { Automation } from "@/types/automation"
import { AutomationEditor } from "./AutomationEditor"
import type { Field } from "@/types/core"

interface Props {
  baseId: string
  fields: Field[]
  onClose: () => void
}

export function AutomationsPanel({ baseId, fields, onClose }: Props) {
  const [automations, setAutomations] = useState<Automation[]>([])
  const [editing, setEditing] = useState<Automation | null>(null)
  const [saving, setSaving] = useState(false)

  const load = useCallback(async () => {
    const res = await fetch(`/api/automations/${baseId}`)
    if (res.ok) setAutomations(await res.json())
    else toast.error("Failed to load automations")
  }, [baseId])

  useEffect(() => { load() }, [load])

  const save = useCallback(async (next: Automation[]) => {
    setSaving(true)
    try {
      const res = await fetch(`/api/automations/${baseId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(next),
      })
      if (!res.ok) { toast.error("Failed to save"); return }
      const saved: Automation[] = await res.json()
      setAutomations(saved)
    } finally {
      setSaving(false)
    }
  }, [baseId])

  const addAutomation = async () => {
    const a = newAutomation()
    const next = [...automations, a]
    await save(next)
    setEditing(a)
  }

  const toggleActive = async (id: string) => {
    const next = automations.map((a) => a.id === id ? { ...a, active: !a.active } : a)
    await save(next)
  }

  const saveAutomation = async (updated: Automation) => {
    const next = automations.map((a) => a.id === updated.id ? updated : a)
    await save(next)
    setEditing(updated)
  }

  const deleteAutomation = async (id: string) => {
    const next = automations.filter((a) => a.id !== id)
    await save(next)
    if (editing?.id === id) setEditing(null)
  }

  if (editing) {
    return (
      <AutomationEditor
        automation={editing}
        fields={fields}
        baseId={baseId}
        onSave={saveAutomation}
        onDelete={() => deleteAutomation(editing.id)}
        onBack={() => setEditing(null)}
      />
    )
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between px-4 py-3 border-b bg-white shrink-0">
        <div className="flex items-center gap-2">
          <Zap size={14} className="text-orange-500" />
          <span className="text-sm font-semibold text-neutral-800">Automations</span>
          {saving && <span className="text-[10px] text-neutral-400">Saving…</span>}
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={addAutomation}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-orange-500 text-white rounded hover:bg-orange-600"
          >
            <Plus size={12} /> New
          </button>
          <button onClick={onClose} className="text-neutral-400 hover:text-neutral-700">
            <X size={16} />
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-2">
        {automations.length === 0 && (
          <div className="border-2 border-dashed rounded-lg p-10 text-center">
            <Zap size={20} className="text-neutral-300 mx-auto mb-2" />
            <p className="text-xs text-neutral-400">No automations yet.</p>
            <p className="text-[11px] text-neutral-300 mt-1">Create one to generate listings automatically.</p>
          </div>
        )}

        {automations.map((a) => (
          <div
            key={a.id}
            className="group flex items-center gap-3 px-3 py-2.5 rounded-lg border bg-white hover:border-orange-200 cursor-pointer transition-colors"
            onClick={() => setEditing(a)}
          >
            <button
              onClick={(e) => { e.stopPropagation(); toggleActive(a.id) }}
              className={cn(
                "w-8 h-4 rounded-full transition-colors shrink-0 relative",
                a.active ? "bg-orange-500" : "bg-neutral-200"
              )}
            >
              <span className={cn(
                "absolute top-0.5 w-3 h-3 rounded-full bg-white shadow transition-all",
                a.active ? "left-4" : "left-0.5"
              )} />
            </button>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium text-neutral-800">{a.name}</p>
              <p className="text-[11px] text-neutral-400 truncate">
                {a.trigger.type === "field_filled"
                  ? `When ${a.trigger.fieldName ?? "field"} filled`
                  : a.trigger.type === "row_created"
                  ? "When row created"
                  : "Manual only"}
                {a.filter ? ` · ${a.filter.fieldName} = ${a.filter.value}` : ""}
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add components/automations/AutomationsPanel.tsx
git commit -m "feat(automation): add AutomationsPanel list view"
```

---

### Task 6: Create action sub-components

**Files:**
- Create: `components/automations/GenerateAIAction.tsx`
- Create: `components/automations/PublishEtsyAction.tsx`
- Create: `components/automations/SetFieldAction.tsx`

- [ ] **Step 1: Create GenerateAIAction.tsx**

```typescript
// components/automations/GenerateAIAction.tsx
"use client"

import { useState } from "react"
import { Info } from "lucide-react"
import type { GenerateAIAction as GenerateAIActionType } from "@/types/automation"
import type { Field } from "@/types/core"
import { DEFAULT_GENERATE_PROMPT } from "@/types/automation"

interface Props {
  action: GenerateAIActionType
  fields: Field[]
  onChange: (action: GenerateAIActionType) => void
}

export function GenerateAIAction({ action, fields, onChange }: Props) {
  const [showVars, setShowVars] = useState(false)

  const generatableFields = fields.filter((f) =>
    ["text", "longText", "multiSelect"].includes(f.type)
  )

  return (
    <div className="space-y-3">
      <div>
        <div className="flex items-center justify-between mb-1">
          <label className="text-xs font-medium text-neutral-700">AI Prompt</label>
          <button
            onClick={() => setShowVars((v) => !v)}
            className="flex items-center gap-1 text-[11px] text-orange-500 hover:text-orange-700"
          >
            <Info size={11} /> {{"{{"}}FieldName{"}}"}
          </button>
        </div>
        {showVars && (
          <div className="mb-2 p-2 rounded bg-orange-50 border border-orange-100 text-[11px] text-neutral-500 space-y-0.5">
            <p>Use <code className="text-orange-600 font-mono">{"{{FieldName}}"}</code> to insert any column value into your prompt.</p>
            <p>Available: {fields.map((f) => <code key={f.id} className="text-orange-600 font-mono mr-1">{`{{${f.name}}}`}</code>)}</p>
          </div>
        )}
        <textarea
          value={action.prompt}
          onChange={(e) => onChange({ ...action, prompt: e.target.value })}
          rows={8}
          placeholder={DEFAULT_GENERATE_PROMPT}
          className="w-full text-xs border rounded px-3 py-2 outline-none focus:border-orange-400 font-mono resize-y"
        />
      </div>

      <div>
        <label className="text-xs font-medium text-neutral-700 block mb-1">Write results to</label>
        <div className="flex flex-wrap gap-1.5">
          {generatableFields.map((f) => {
            const selected = action.writeToFields.includes(f.name)
            return (
              <button
                key={f.id}
                onClick={() => {
                  const next = selected
                    ? action.writeToFields.filter((n) => n !== f.name)
                    : [...action.writeToFields, f.name]
                  onChange({ ...action, writeToFields: next })
                }}
                className={`px-2 py-0.5 rounded-full border text-[11px] transition-colors ${
                  selected
                    ? "bg-orange-100 border-orange-300 text-orange-700"
                    : "bg-white border-neutral-200 text-neutral-500 hover:border-neutral-300"
                }`}
              >
                {f.name}
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Create PublishEtsyAction.tsx**

```typescript
// components/automations/PublishEtsyAction.tsx
"use client"

import { useEffect, useState } from "react"
import type { PublishEtsyAction as PublishEtsyActionType } from "@/types/automation"

interface StoreData {
  connected: boolean
  sections: Array<{ id: number; title: string }>
  returnPolicies: Array<{ id: number; name: string }>
  shippingProfiles: Array<{ id: number; title: string }>
}

interface TaxonomyNode {
  id: number
  name: string
  children?: TaxonomyNode[]
}

function flattenTaxonomy(nodes: TaxonomyNode[], prefix = ""): Array<{ id: number; label: string }> {
  const result: Array<{ id: number; label: string }> = []
  for (const node of nodes) {
    const label = prefix ? `${prefix} > ${node.name}` : node.name
    result.push({ id: node.id, label })
    if (node.children?.length) result.push(...flattenTaxonomy(node.children, label))
  }
  return result
}

interface Props {
  action: PublishEtsyActionType
  baseId: string
  onChange: (action: PublishEtsyActionType) => void
}

export function PublishEtsyAction({ action, baseId, onChange }: Props) {
  const [storeData, setStoreData] = useState<StoreData | null>(null)
  const [taxonomy, setTaxonomy] = useState<Array<{ id: number; label: string }>>([])
  const [taxSearch, setTaxSearch] = useState("")

  useEffect(() => {
    fetch(`/api/etsy/store-data/${baseId}`).then((r) => r.json()).then(setStoreData).catch(() => {})
    fetch("/api/etsy/taxonomy").then((r) => r.json()).then((n) => setTaxonomy(flattenTaxonomy(n))).catch(() => {})
  }, [baseId])

  const up = (patch: Partial<PublishEtsyActionType>) => onChange({ ...action, ...patch })

  return (
    <div className="space-y-3">
      {/* Taxonomy */}
      <div>
        <label className="text-xs font-medium text-neutral-700 block mb-1">Etsy Category (Taxonomy)</label>
        {taxonomy.length > 0 ? (
          <div className="space-y-1">
            <input
              type="text"
              placeholder="Search…"
              value={taxSearch}
              onChange={(e) => setTaxSearch(e.target.value)}
              className="w-full text-xs border rounded px-2 py-1.5 outline-none focus:border-orange-400"
            />
            <select
              size={4}
              value={action.taxonomyId ?? ""}
              onChange={(e) => up({ taxonomyId: e.target.value ? Number(e.target.value) : undefined })}
              className="w-full text-xs border rounded px-2 py-1 outline-none focus:border-orange-400"
            >
              <option value="">— none —</option>
              {taxonomy
                .filter((t) => !taxSearch || t.label.toLowerCase().includes(taxSearch.toLowerCase()))
                .slice(0, 100)
                .map((t) => <option key={t.id} value={t.id}>{t.label}</option>)}
            </select>
          </div>
        ) : (
          <input
            type="number"
            value={action.taxonomyId ?? ""}
            onChange={(e) => up({ taxonomyId: e.target.value ? Number(e.target.value) : undefined })}
            placeholder="Connect store to load categories"
            className="w-full text-xs border rounded px-2 py-1.5 outline-none focus:border-orange-400"
          />
        )}
      </div>

      {/* Shop Section */}
      <div>
        <label className="text-xs font-medium text-neutral-700 block mb-1">Shop Section</label>
        {storeData?.connected && storeData.sections.length > 0 ? (
          <select
            value={action.shopSectionId ?? ""}
            onChange={(e) => up({ shopSectionId: e.target.value ? Number(e.target.value) : undefined })}
            className="w-full text-xs border rounded px-2 py-1.5 outline-none focus:border-orange-400"
          >
            <option value="">— none —</option>
            {storeData.sections.map((s) => <option key={s.id} value={s.id}>{s.title}</option>)}
          </select>
        ) : (
          <input
            type="number"
            value={action.shopSectionId ?? ""}
            onChange={(e) => up({ shopSectionId: e.target.value ? Number(e.target.value) : undefined })}
            placeholder={storeData?.connected ? "No sections found" : "Connect store for dropdown"}
            className="w-full text-xs border rounded px-2 py-1.5 outline-none focus:border-orange-400"
          />
        )}
      </div>

      {/* Return Policy */}
      <div>
        <label className="text-xs font-medium text-neutral-700 block mb-1">Return Policy</label>
        {storeData?.connected && storeData.returnPolicies.length > 0 ? (
          <select
            value={action.returnPolicyId ?? ""}
            onChange={(e) => up({ returnPolicyId: e.target.value ? Number(e.target.value) : undefined })}
            className="w-full text-xs border rounded px-2 py-1.5 outline-none focus:border-orange-400"
          >
            <option value="">— none —</option>
            {storeData.returnPolicies.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        ) : (
          <input
            type="number"
            value={action.returnPolicyId ?? ""}
            onChange={(e) => up({ returnPolicyId: e.target.value ? Number(e.target.value) : undefined })}
            placeholder={storeData?.connected ? "No policies found" : "Connect store for dropdown"}
            className="w-full text-xs border rounded px-2 py-1.5 outline-none focus:border-orange-400"
          />
        )}
      </div>

      {/* Default Price */}
      <div>
        <label className="text-xs font-medium text-neutral-700 block mb-1">Default Price ($)</label>
        <input
          type="number"
          value={action.defaultPrice ?? ""}
          onChange={(e) => up({ defaultPrice: e.target.value ? Number(e.target.value) : undefined })}
          className="w-full text-xs border rounded px-2 py-1.5 outline-none focus:border-orange-400"
        />
      </div>

      {/* Publish state */}
      <div className="flex items-center gap-4">
        <span className="text-xs font-medium text-neutral-700 w-28 shrink-0">Publish as</span>
        <label className="flex items-center gap-1.5 text-xs text-neutral-700 cursor-pointer">
          <input
            type="radio"
            checked={action.publishState === "draft"}
            onChange={() => up({ publishState: "draft" })}
            className="accent-orange-500"
          /> Draft
        </label>
        <label className="flex items-center gap-1.5 text-xs text-neutral-700 cursor-pointer">
          <input
            type="radio"
            checked={action.publishState === "active"}
            onChange={() => up({ publishState: "active" })}
            className="accent-orange-500"
          /> Active
        </label>
      </div>

      {/* Require approval */}
      <label className="flex items-center gap-3 cursor-pointer">
        <input
          type="checkbox"
          checked={action.requireApproval}
          onChange={(e) => up({ requireApproval: e.target.checked })}
          className="w-4 h-4 rounded accent-orange-500"
        />
        <span className="text-xs text-neutral-700">Require manual approval before publishing</span>
      </label>
    </div>
  )
}
```

- [ ] **Step 3: Create SetFieldAction.tsx**

```typescript
// components/automations/SetFieldAction.tsx
"use client"

import type { SetFieldAction as SetFieldActionType } from "@/types/automation"
import type { Field } from "@/types/core"

interface Props {
  action: SetFieldActionType
  fields: Field[]
  onChange: (action: SetFieldActionType) => void
}

export function SetFieldAction({ action, fields, onChange }: Props) {
  return (
    <div className="grid grid-cols-2 gap-3">
      <div>
        <label className="text-xs font-medium text-neutral-700 block mb-1">Field</label>
        <select
          value={action.fieldName}
          onChange={(e) => onChange({ ...action, fieldName: e.target.value })}
          className="w-full text-xs border rounded px-2 py-1.5 outline-none focus:border-orange-400"
        >
          <option value="">— select field —</option>
          {fields.map((f) => <option key={f.id} value={f.name}>{f.name}</option>)}
        </select>
      </div>
      <div>
        <label className="text-xs font-medium text-neutral-700 block mb-1">Value</label>
        <input
          value={action.value}
          onChange={(e) => onChange({ ...action, value: e.target.value })}
          className="w-full text-xs border rounded px-2 py-1.5 outline-none focus:border-orange-400"
        />
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Commit**

```bash
git add components/automations/GenerateAIAction.tsx components/automations/PublishEtsyAction.tsx components/automations/SetFieldAction.tsx
git commit -m "feat(automation): add action sub-components (GenerateAI, PublishEtsy, SetField)"
```

---

### Task 7: Create AutomationEditor (linear scrollable form)

**Files:**
- Create: `components/automations/AutomationEditor.tsx`

- [ ] **Step 1: Create the component**

```typescript
// components/automations/AutomationEditor.tsx
"use client"

import { useState } from "react"
import { ArrowLeft, Plus, Trash2, Save, GripVertical } from "lucide-react"
import { cn } from "@/lib/utils"
import type { Automation, AutomationAction, GenerateAIAction, PublishEtsyAction, SetFieldAction } from "@/types/automation"
import type { Field } from "@/types/core"
import { GenerateAIAction as GenerateAIForm } from "./GenerateAIAction"
import { PublishEtsyAction as PublishEtsyForm } from "./PublishEtsyAction"
import { SetFieldAction as SetFieldForm } from "./SetFieldAction"
import { DEFAULT_GENERATE_PROMPT } from "@/types/automation"
import { v4 as uuid } from "uuid"

const TRIGGER_OPTIONS = [
  { value: "field_filled", label: "When field is filled" },
  { value: "row_created", label: "When row is created" },
  { value: "manual", label: "Manual only (Run button)" },
] as const

const ACTION_LABELS: Record<string, string> = {
  generate_ai: "Generate with AI",
  publish_etsy: "Publish to Etsy",
  set_field: "Set field value",
}

interface Props {
  automation: Automation
  fields: Field[]
  baseId: string
  onSave: (updated: Automation) => Promise<void>
  onDelete: () => void
  onBack: () => void
}

export function AutomationEditor({ automation, fields, baseId, onSave, onDelete, onBack }: Props) {
  const [draft, setDraft] = useState<Automation>({ ...automation, actions: [...automation.actions] })
  const [saving, setSaving] = useState(false)
  const [showAddAction, setShowAddAction] = useState(false)

  const update = <K extends keyof Automation>(key: K, value: Automation[K]) =>
    setDraft((prev) => ({ ...prev, [key]: value }))

  const updateAction = (index: number, action: AutomationAction) =>
    setDraft((prev) => {
      const actions = [...prev.actions]
      actions[index] = action
      return { ...prev, actions }
    })

  const removeAction = (index: number) =>
    setDraft((prev) => ({ ...prev, actions: prev.actions.filter((_, i) => i !== index) }))

  const addAction = (type: "generate_ai" | "publish_etsy" | "set_field") => {
    setShowAddAction(false)
    let action: AutomationAction
    if (type === "generate_ai") {
      action = { type: "generate_ai", prompt: DEFAULT_GENERATE_PROMPT, writeToFields: ["Title", "Tags", "Description"] } as GenerateAIAction
    } else if (type === "publish_etsy") {
      action = { type: "publish_etsy", publishState: "draft", requireApproval: true } as PublishEtsyAction
    } else {
      action = { type: "set_field", fieldName: "", value: "" } as SetFieldAction
    }
    setDraft((prev) => ({ ...prev, actions: [...prev.actions, action] }))
  }

  const handleSave = async () => {
    setSaving(true)
    try { await onSave(draft) } finally { setSaving(false) }
  }

  const fieldNameOptions = fields.map((f) => f.name)

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 border-b bg-white shrink-0">
        <button onClick={onBack} className="text-neutral-400 hover:text-neutral-700">
          <ArrowLeft size={16} />
        </button>
        <input
          value={draft.name}
          onChange={(e) => update("name", e.target.value)}
          className="flex-1 text-sm font-semibold text-neutral-800 outline-none bg-transparent border-b border-transparent focus:border-orange-300"
        />
        {/* Active toggle */}
        <button
          onClick={() => update("active", !draft.active)}
          className={cn(
            "w-10 h-5 rounded-full transition-colors relative shrink-0",
            draft.active ? "bg-orange-500" : "bg-neutral-200"
          )}
        >
          <span className={cn(
            "absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-all",
            draft.active ? "left-5" : "left-0.5"
          )} />
        </button>
        <button
          onClick={handleSave}
          disabled={saving}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-orange-500 text-white rounded hover:bg-orange-600 disabled:opacity-50 shrink-0"
        >
          <Save size={12} /> {saving ? "Saving…" : "Save"}
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-5 space-y-6 max-w-lg">

        {/* TRIGGER */}
        <section className="space-y-3">
          <h3 className="text-[11px] font-semibold text-neutral-400 uppercase tracking-wider">Trigger</h3>
          <div className="space-y-2">
            <select
              value={draft.trigger.type}
              onChange={(e) => update("trigger", { type: e.target.value as typeof draft.trigger.type })}
              className="w-full text-xs border rounded px-2 py-1.5 outline-none focus:border-orange-400"
            >
              {TRIGGER_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
            {draft.trigger.type === "field_filled" && (
              <div className="flex items-center gap-2">
                <span className="text-xs text-neutral-500 shrink-0">Field:</span>
                <select
                  value={draft.trigger.fieldName ?? ""}
                  onChange={(e) => update("trigger", { ...draft.trigger, fieldName: e.target.value })}
                  className="flex-1 text-xs border rounded px-2 py-1.5 outline-none focus:border-orange-400"
                >
                  <option value="">— select field —</option>
                  {fieldNameOptions.map((n) => <option key={n} value={n}>{n}</option>)}
                </select>
              </div>
            )}
          </div>
        </section>

        {/* FILTER */}
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-[11px] font-semibold text-neutral-400 uppercase tracking-wider">Filter <span className="normal-case font-normal">(optional)</span></h3>
            {draft.filter
              ? <button onClick={() => update("filter", undefined)} className="text-[11px] text-neutral-400 hover:text-red-500">Remove</button>
              : <button onClick={() => update("filter", { fieldName: "Category", value: "" })} className="text-[11px] text-orange-500 hover:text-orange-700">+ Add filter</button>
            }
          </div>
          {draft.filter && (
            <div className="grid grid-cols-2 gap-2">
              <select
                value={draft.filter.fieldName}
                onChange={(e) => update("filter", { ...draft.filter!, fieldName: e.target.value })}
                className="text-xs border rounded px-2 py-1.5 outline-none focus:border-orange-400"
              >
                {fieldNameOptions.map((n) => <option key={n} value={n}>{n}</option>)}
              </select>
              <input
                value={draft.filter.value}
                onChange={(e) => update("filter", { ...draft.filter!, value: e.target.value })}
                placeholder="equals…"
                className="text-xs border rounded px-2 py-1.5 outline-none focus:border-orange-400"
              />
            </div>
          )}
        </section>

        {/* ACTIONS */}
        <section className="space-y-3">
          <h3 className="text-[11px] font-semibold text-neutral-400 uppercase tracking-wider">Actions</h3>

          {draft.actions.length === 0 && (
            <p className="text-[11px] text-neutral-400">No actions yet. Add one below.</p>
          )}

          {draft.actions.map((action, i) => (
            <div key={i} className="rounded-lg border bg-white overflow-hidden">
              <div className="flex items-center gap-2 px-3 py-2 bg-neutral-50 border-b">
                <GripVertical size={13} className="text-neutral-300" />
                <span className="flex-1 text-xs font-medium text-neutral-700">
                  {i + 1}. {ACTION_LABELS[action.type] ?? action.type}
                </span>
                <button onClick={() => removeAction(i)} className="text-neutral-300 hover:text-red-500">
                  <Trash2 size={13} />
                </button>
              </div>
              <div className="p-3">
                {action.type === "generate_ai" && (
                  <GenerateAIForm
                    action={action as GenerateAIAction}
                    fields={fields}
                    onChange={(a) => updateAction(i, a)}
                  />
                )}
                {action.type === "publish_etsy" && (
                  <PublishEtsyForm
                    action={action as PublishEtsyAction}
                    baseId={baseId}
                    onChange={(a) => updateAction(i, a)}
                  />
                )}
                {action.type === "set_field" && (
                  <SetFieldForm
                    action={action as SetFieldAction}
                    fields={fields}
                    onChange={(a) => updateAction(i, a)}
                  />
                )}
              </div>
            </div>
          ))}

          {/* Add action */}
          <div className="relative">
            <button
              onClick={() => setShowAddAction((v) => !v)}
              className="flex items-center gap-1.5 text-xs text-orange-500 hover:text-orange-700"
            >
              <Plus size={12} /> Add action
            </button>
            {showAddAction && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setShowAddAction(false)} />
                <div className="absolute left-0 top-full mt-1 z-50 w-48 bg-white border rounded-lg shadow-lg py-1">
                  {(["generate_ai", "publish_etsy", "set_field"] as const).map((type) => (
                    <button
                      key={type}
                      onClick={() => addAction(type)}
                      className="w-full text-left px-3 py-2 text-xs text-neutral-700 hover:bg-orange-50"
                    >
                      {ACTION_LABELS[type]}
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>
        </section>

        {/* Danger zone */}
        <section className="pt-4 border-t">
          <button
            onClick={onDelete}
            className="text-xs text-red-500 hover:text-red-700 hover:underline"
          >
            Delete automation
          </button>
        </section>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add components/automations/AutomationEditor.tsx
git commit -m "feat(automation): add AutomationEditor linear form"
```

---

### Task 8: Wire AutomationsPanel into TableView

**Files:**
- Modify: `components/table/TableView.tsx`

- [ ] **Step 1: Swap the import**

Find the line:
```typescript
import { ListingSettingsPanel } from "@/components/listing-settings/ListingSettingsPanel"
```
Replace with:
```typescript
import { AutomationsPanel } from "@/components/automations/AutomationsPanel"
```

- [ ] **Step 2: Swap the rendered component**

Find the block (around line 588):
```typescript
{showSettings && activeBaseId ? (
  <ListingSettingsPanel
    baseId={activeBaseId}
    fields={fields}
    onClose={() => setShowSettings(false)}
  />
) : (
```
Replace with:
```typescript
{showSettings && activeBaseId ? (
  <AutomationsPanel
    baseId={activeBaseId}
    fields={fields}
    onClose={() => setShowSettings(false)}
  />
) : (
```

- [ ] **Step 3: Verify the app builds**

```bash
npm run build
```
Expected: no TypeScript errors.

- [ ] **Step 4: Smoke test in browser**

1. Open an Etsy base
2. Click the settings gear/button in ViewTabs — Automations panel opens
3. Click "New" — editor opens with trigger, filter, actions sections
4. Add a "Generate with AI" action — form appears
5. Save — returns to list, automation appears with toggle
6. Click Run in toolbar — a row should still generate (uses resolveAutomation fallback)

- [ ] **Step 5: Commit**

```bash
git add components/table/TableView.tsx
git commit -m "feat(automation): wire AutomationsPanel into TableView"
```

---

### Task 9: Delete old listing-settings files

**Files:**
- Delete: `components/listing-settings/` (entire directory)
- Delete: `types/listing-settings.ts` (after verifying no remaining imports)

- [ ] **Step 1: Check for remaining imports**

```bash
grep -r "listing-settings\|ListingSettings\|emptySettings" --include="*.ts" --include="*.tsx" . | grep -v node_modules | grep -v ".next"
```

Expected: only `app/api/listing-settings/` route and `types/core.ts` (which keeps the optional field for migration). If anything else imports it, fix those imports first.

- [ ] **Step 2: Update types/core.ts to remove the listing-settings import**

In `types/core.ts`, the `BaseConfig` still has `listingSettings?: ListingSettings` for backward-compat reads. Keep the import but mark it deprecated by adding a comment:

```typescript
// Keep for backward-compat migration reads — do not add new usages
import type { ListingSettings } from "@/types/listing-settings"
```

This lets the old API route (`app/api/listing-settings/`) still compile for any existing data.

- [ ] **Step 3: Delete the old UI directory**

```bash
rm -rf components/listing-settings
```

- [ ] **Step 4: Verify build**

```bash
npm run build
```
Expected: clean build.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "chore: remove listing-settings UI components (replaced by automations)"
```

---

## Verification

End-to-end check after all tasks:

1. **Automations panel opens** — click settings icon on an Etsy base → see the Automations list
2. **Create automation** — click New, set trigger to "When Images filled", add Generate AI action with a prompt, save
3. **Run row** — select a row with images, click Run in toolbar → row gets Title/Tags/Description written, Automation State = "review"
4. **Filter matching** — create two automations with different `filter.value` ("Art Print" vs "Digital"), set Category on rows, run — confirm each row picks the right automation
5. **Toggle on/off** — disable an automation, run — row should use fallback or skip
6. **No regressions** — Etsy publish flow, batch abort, progress counter all work as before
