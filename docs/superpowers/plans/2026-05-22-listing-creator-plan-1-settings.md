# Listing Creator — Plan 1: Types, API & Settings UI

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the Listing Settings panel — the full configuration UI for listing categories, field roles, AI templates, description blocks, and automation rules — stored in `Base.config.listingSettings`.

**Architecture:** Settings are stored as a `listingSettings` JSON blob inside the existing `Base.config` field — no schema migration needed. A dedicated API route reads/writes that key. The settings panel opens inline in the workspace (replaces the grid area) when the gear icon in ViewTabs is clicked. All category/field/template config lives in this panel.

**Tech Stack:** Next.js App Router, React 19, TypeScript, Prisma/SQLite, Tailwind CSS v4, shadcn/ui, lucide-react, sonner toasts.

---

## File Map

**New files:**
- `types/listing-settings.ts` — all ListingSettings types (kept separate from core.ts)
- `app/api/listing-settings/[baseId]/route.ts` — GET/PATCH settings
- `components/listing-settings/ListingSettingsPanel.tsx` — panel shell + nav
- `components/listing-settings/StoreDefaultsSection.tsx` — global defaults tab
- `components/listing-settings/CategoriesSection.tsx` — category list + create
- `components/listing-settings/CategoryEditor.tsx` — 5-section category editor
- `components/listing-settings/FieldRoleTable.tsx` — per-field role assignment table
- `components/listing-settings/TriggerConfig.tsx` — trigger condition UI
- `components/listing-settings/AITemplateEditor.tsx` — prompt template editor with variable reference
- `components/listing-settings/DescriptionBlockEditor.tsx` — drag-reorder block template editor
- `components/listing-settings/PostProcessRules.tsx` — post-process rules list
- `components/listing-settings/TemplatesLibrary.tsx` — reusable templates list

**Modified files:**
- `types/core.ts` — import + re-export `BaseConfig` with `listingSettings`
- `app/api/seed/etsy/route.ts` — add new fields, remove Materials + Production Partner IDs
- `components/app/BaseSidebar.tsx` — separate Etsy Store section, "+ New Listing" button
- `components/app/ViewTabs.tsx` — gear icon pinned right (Etsy only)
- `components/table/TableView.tsx` — settings panel state + conditional render

---

## Task 1: ListingSettings types

**Files:**
- Create: `types/listing-settings.ts`
- Modify: `types/core.ts` (add import)

- [ ] **Step 1: Create `types/listing-settings.ts`**

```typescript
import { v4 as uuid } from "uuid"

export type FieldRole = "trigger" | "context" | "generated" | "default" | "manual" | "hidden"
export type TriggerType = "field_filled" | "fields_filled" | "status_equals" | "row_created" | "manual"
export type PublishState = "draft" | "active"
export type AutomationState = "idle" | "queued" | "detecting" | "generating" | "review" | "published" | "error"

export interface FieldRoleConfig {
  fieldName: string
  roles: FieldRole[]          // combined: ["trigger", "context"]
  defaultValue?: string | number | boolean | null
  contextHint?: string        // placeholder shown in grid cell for context fields
}

export interface TriggerCondition {
  type: TriggerType
  fieldNames?: string[]       // for field_filled / fields_filled
  statusValue?: string        // for status_equals
}

export interface DescriptionBlock {
  id: string
  type: "fixed" | "ai" | "context_var"
  content: string             // static text, AI instructions, or variable name like "title_hint"
}

export interface PostProcessRule {
  id: string
  fieldName: string
  type: "append_tags" | "exclude_tags" | "max_chars" | "capitalize_first" | "regex_replace"
  value: string               // tag list (comma-sep), max num, or regex pattern
  replacement?: string        // for regex_replace only
}

export interface ListingCategory {
  id: string
  name: string
  icon: string
  color: string
  shopSectionId?: number
  taxonomyId?: number
  returnPolicyId?: number
  defaultPrice?: number
  trigger: TriggerCondition
  fieldRoles: FieldRoleConfig[]
  templateId?: string         // reference to PromptTemplate id
  templateOverride?: string   // inline prompt override (takes precedence over templateId)
  descriptionBlocks: DescriptionBlock[]
  postProcessRules: PostProcessRule[]
  publishState: PublishState
  autoPublish: boolean
  requireApproval: boolean
  autoRun: boolean
}

export interface PromptTemplate {
  id: string
  name: string
  description: string
  prompt: string
  parentId?: string           // for inheritance chain
}

export interface ListingSettings {
  fieldDefaults: Record<string, string | number | boolean | null>
  globalAutoRun: boolean
  batchSize: number
  defaultCategoryId?: string
  categories: ListingCategory[]
  templates: PromptTemplate[]
}

export function emptySettings(): ListingSettings {
  return {
    fieldDefaults: {
      "Who Made": "i_did",
      "When Made": "2020_2025",
      "Is Taxable": true,
      "Auto Renew": true,
      "Quantity": 999,
      "Is Supply": false,
    },
    globalAutoRun: false,
    batchSize: 10,
    categories: [],
    templates: [],
  }
}

export function newCategory(): ListingCategory {
  return {
    id: uuid(),
    name: "New Category",
    icon: "🖼️",
    color: "#6366f1",
    trigger: { type: "field_filled", fieldNames: ["Images"] },
    fieldRoles: [],
    descriptionBlocks: [],
    postProcessRules: [],
    publishState: "draft",
    autoPublish: false,
    requireApproval: false,
    autoRun: false,
  }
}

export function newBlock(type: DescriptionBlock["type"] = "fixed"): DescriptionBlock {
  return { id: uuid(), type, content: "" }
}

export function newPostProcessRule(fieldName = "Tags"): PostProcessRule {
  return { id: uuid(), fieldName, type: "append_tags", value: "" }
}

// Variable reference for AI template editor
export const TEMPLATE_VARIABLES: Array<{ name: string; description: string }> = [
  { name: "{{title_hint}}", description: "Value typed in the Title context field" },
  { name: "{{image_analysis}}", description: "AI's description of the uploaded images" },
  { name: "{{category_name}}", description: "Name of the matched category" },
  { name: "{{style_tags}}", description: "Any styles already on the row" },
  { name: "{{shop_section}}", description: "Etsy shop section name from category settings" },
]
```

- [ ] **Step 2: Update `types/core.ts` — add listingSettings to BaseConfig**

Add this import at the top and update `BaseConfig`:

```typescript
import type { ListingSettings } from "@/types/listing-settings"

// Replace the existing BaseConfig interface:
export interface BaseConfig {
  integration?: "etsy" | string
  listingSettings?: ListingSettings
}
```

- [ ] **Step 3: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```
Expected: no errors related to the new types.

- [ ] **Step 4: Commit**

```bash
git add types/listing-settings.ts types/core.ts
git commit -m "feat: add ListingSettings type definitions"
```

---

## Task 2: Update Digital Listings seed — new fields, remove invalid ones

**Files:**
- Modify: `app/api/seed/etsy/route.ts`

The seed route creates the Digital Listings table fields. We need to:
- Add: Category (singleSelect), Listing URL (url), Automation State (singleSelect, hidden by default), Processing Min Days, Processing Max Days, Last Generated At (date)
- Remove: Materials, Production Partner IDs (not applicable for digital)

- [ ] **Step 1: Update `COMMON_FIELDS` and `DIGITAL_FIELDS` in `app/api/seed/etsy/route.ts`**

Replace the existing field arrays with:

```typescript
const AUTOMATION_STATE_OPTIONS = [
  { id: "idle",       label: "Idle",       color: "#a3a3a3" },
  { id: "queued",     label: "Queued",     color: "#eab308" },
  { id: "detecting",  label: "Detecting",  color: "#3b82f6" },
  { id: "generating", label: "Generating", color: "#8b5cf6" },
  { id: "review",     label: "Review",     color: "#f97316" },
  { id: "published",  label: "Published",  color: "#22c55e" },
  { id: "error",      label: "Error",      color: "#ef4444" },
]

const COMMON_FIELDS = [
  { name: "Title",                       type: "text",         isPrimary: true, config: {} },
  { name: "Description",                 type: "longText",     config: {} },
  { name: "Type",                        type: "singleSelect", config: { options: [{ id: "digital", label: "Digital", color: "#a3a3a3" }] } },
  { name: "Price",                       type: "number",       config: { numberFormat: "currency", currency: "USD" } },
  { name: "Quantity",                    type: "number",       config: { numberFormat: "integer" } },
  { name: "Status",                      type: "singleSelect", config: { options: STATUS_OPTIONS } },
  { name: "Automation State",            type: "singleSelect", config: { options: AUTOMATION_STATE_OPTIONS } },
  { name: "Category",                    type: "singleSelect", config: { options: [] } },
  { name: "Tags",                        type: "multiSelect",  config: {} },
  { name: "Styles",                      type: "multiSelect",  config: {} },
  { name: "Images",                      type: "attachment",   config: {} },
  { name: "Video",                       type: "attachment",   config: {} },
  { name: "SKU",                         type: "text",         config: {} },
  { name: "Taxonomy ID",                 type: "number",       config: { numberFormat: "integer" } },
  { name: "When Made",                   type: "singleSelect", config: { options: WHEN_MADE_OPTIONS } },
  { name: "Who Made",                    type: "singleSelect", config: { options: WHO_MADE_OPTIONS } },
  { name: "Is Supply",                   type: "checkbox",     config: {} },
  { name: "AI Generated",                type: "checkbox",     config: {} },
  { name: "Is Personalizable",           type: "checkbox",     config: {} },
  { name: "Personalisation Required",    type: "checkbox",     config: {} },
  { name: "Personalisation Max Chars",   type: "number",       config: { numberFormat: "integer" } },
  { name: "Personalisation Instructions",type: "longText",     config: {} },
  { name: "Featured",                    type: "checkbox",     config: {} },
  { name: "Shop Section ID",             type: "number",       config: { numberFormat: "integer" } },
  { name: "Return Policy ID",            type: "number",       config: { numberFormat: "integer" } },
  { name: "Is Taxable",                  type: "checkbox",     config: {} },
  { name: "Auto Renew",                  type: "checkbox",     config: {} },
  { name: "Processing Min Days",         type: "number",       config: { numberFormat: "integer" } },
  { name: "Processing Max Days",         type: "number",       config: { numberFormat: "integer" } },
  { name: "Last Generated At",           type: "date",         config: {} },
  { name: "Listing URL",                 type: "url",          config: {} },
  { name: "Etsy Listing ID",             type: "number",       config: { numberFormat: "integer" } },
] as const

const DIGITAL_FIELDS = [
  ...COMMON_FIELDS.slice(0, 12), // Title → Video
  { name: "Digital Files", type: "attachment", config: {} },
  ...COMMON_FIELDS.slice(12),    // SKU → Etsy Listing ID
] as const

const PHYSICAL_FIELDS = [
  ...COMMON_FIELDS,
  { name: "Shipping Profile ID", type: "number", config: { numberFormat: "integer" } },
] as const
```

- [ ] **Step 2: Delete old dev.db so the seed picks up the new field list**

```bash
rm dev.db
npx prisma db push
```
Expected: `Your database is now in sync with your Prisma schema.`

- [ ] **Step 3: Restart dev server and seed a new Etsy Store via the sidebar button. Verify in the grid that Category, Automation State, Listing URL, Processing Min/Max Days, and Last Generated At columns appear, and Materials + Production Partner IDs do not.**

```bash
npm run dev
```
Open `http://localhost:3000`, create a Space, click "New Etsy Store", open the Digital Listings table. Confirm the new columns exist.

- [ ] **Step 4: Commit**

```bash
git add app/api/seed/etsy/route.ts
git commit -m "feat(seed): add Category, Automation State and metadata fields to Digital Listings"
```

---

## Task 3: Listing Settings API

**Files:**
- Create: `app/api/listing-settings/[baseId]/route.ts`

- [ ] **Step 1: Create the route file**

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
    return NextResponse.json(merged.listingSettings)
  } catch (err) {
    return handleApiError(err)
  }
}
```

- [ ] **Step 2: Test GET returns empty settings for a new Etsy base**

After seeding an Etsy Store, note the base ID from the URL or network tab. Then:

```bash
curl http://localhost:3000/api/listing-settings/<baseId>
```
Expected: JSON with `globalAutoRun: false`, `batchSize: 10`, `categories: []`, `templates: []`.

- [ ] **Step 3: Test PATCH updates settings**

```bash
curl -X PATCH http://localhost:3000/api/listing-settings/<baseId> \
  -H "Content-Type: application/json" \
  -d '{"batchSize": 8}'
```
Expected: returns updated settings with `batchSize: 8`.

- [ ] **Step 4: Commit**

```bash
git add app/api/listing-settings/
git commit -m "feat: add listing settings GET/PATCH API"
```

---

## Task 4: Sidebar — Etsy Store section

**Files:**
- Modify: `components/app/BaseSidebar.tsx`

The sidebar currently shows all bases in one list with "New Etsy Store" at the bottom. Split it so Etsy bases appear in a dedicated section above the generic bases, with their own "+ New Listing" button.

- [ ] **Step 1: Split bases into `etsyBases` and `genericBases` inside `BaseSidebar`**

After the `setBases(data)` call in `fetchBases`, the component already has the full list. Add this derived split inside the render:

```typescript
const etsyBases = bases.filter((b) => b.config?.integration === "etsy")
const genericBases = bases.filter((b) => b.config?.integration !== "etsy")
```

- [ ] **Step 2: Replace the JSX in the scrollable section with two sections**

Replace the single `{bases.map(...)}` block with:

```tsx
{/* Etsy Store section */}
{etsyBases.map((base) => (
  <div key={base.id} className="mb-3">
    <div className="flex items-center gap-1.5 px-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-neutral-400 select-none">
      <ShoppingBag size={10} />
      {base.name}
    </div>
    {base.tables.map((table) => (
      <div
        key={table.id}
        className={cn(
          "group flex items-center gap-1.5 rounded-md px-2 py-1 hover:bg-orange-50 cursor-pointer ml-1",
          activeTableId === table.id && "bg-orange-50"
        )}
        onClick={() => { openTable(table.id); setActiveBaseId(base.id); setActiveBaseIntegration(base.config?.integration ?? null) }}
      >
        <Table2 size={12} className={cn("shrink-0", activeTableId === table.id ? "text-orange-500" : "text-neutral-400")} />
        <span className={cn("flex-1 text-xs truncate", activeTableId === table.id ? "text-orange-600 font-medium" : "text-neutral-600")}>
          {table.name}
        </span>
      </div>
    ))}
    <button
      className="flex items-center gap-1.5 ml-1 px-2 py-1 text-xs text-orange-500 hover:bg-orange-50 rounded-md w-full"
      onClick={() => addNewListingRow(base)}
    >
      <Plus size={11} /> New Listing
    </button>
  </div>
))}

{/* Divider between Etsy and generic */}
{etsyBases.length > 0 && genericBases.length > 0 && (
  <div className="border-t my-2 mx-2" />
)}

{/* Generic bases */}
{genericBases.map((base) => (
  /* existing base render JSX — unchanged */
))}
```

- [ ] **Step 3: Add `addNewListingRow` function to `BaseSidebar`**

This function opens the first Digital Listings table of the Etsy base and queues a new blank row. Add it alongside `addBase`:

```typescript
const addNewListingRow = (base: BaseWithTables) => {
  const digitalTable = base.tables.find((t) => t.name === "Digital Listings") ?? base.tables[0]
  if (!digitalTable) return
  openTable(digitalTable.id, undefined, base.id)
  setActiveBaseIntegration(base.config?.integration ?? null)
  // Signal to TableView to add a new row and focus Images cell.
  // We use a custom event that TableView listens to.
  window.dispatchEvent(new CustomEvent("etsy:new-listing", { detail: { tableId: digitalTable.id } }))
}
```

- [ ] **Step 4: Verify in browser**

Restart dev server, seed an Etsy Store. Confirm:
- "🛍️ YIVEZ Etsy Store" header appears with Digital/Physical table links
- "New Listing" button appears under each Etsy base
- Generic bases (if any) appear below a divider with unchanged behavior

- [ ] **Step 5: Commit**

```bash
git add components/app/BaseSidebar.tsx
git commit -m "feat(sidebar): separate Etsy Store section with New Listing button"
```

---

## Task 5: ViewTabs — gear icon pinned right

**Files:**
- Modify: `components/app/ViewTabs.tsx`

- [ ] **Step 1: Add `onSettingsClick` and `settingsOpen` props to ViewTabs**

Update the `Props` interface:

```typescript
interface Props {
  views: View[]
  onViewAdded: (view: View) => void
  onViewRenamed: (id: string, name: string) => void
  onViewDeleted: (id: string) => void
  onViewsReordered: (views: View[]) => void
  onSettingsClick?: () => void   // only passed for Etsy tables
  settingsOpen?: boolean
}
```

Update the function signature to destructure the new props:

```typescript
export function ViewTabs({ views, onViewAdded, onViewRenamed, onViewDeleted, onViewsReordered, onSettingsClick, settingsOpen }: Props) {
```

- [ ] **Step 2: Add the gear icon to the right end of the tabs bar**

Add `Settings` to the lucide-react import: `import { ..., Settings } from "lucide-react"`

Then inside the return, change the outer div to `flex` with `justify-between`, and add the gear after the existing content:

```tsx
return (
  <div className="flex items-center border-b bg-white shrink-0 h-9">
    {/* Left: view tabs + add button */}
    <div className="flex items-center gap-0.5 px-3 flex-1 overflow-x-auto h-full">
      {/* ...existing tabs and add view button — unchanged... */}
    </div>

    {/* Right: settings icon (Etsy only) */}
    {onSettingsClick && (
      <button
        onClick={onSettingsClick}
        className={cn(
          "shrink-0 flex items-center justify-center w-9 h-full border-l transition-colors",
          settingsOpen
            ? "text-orange-500 bg-orange-50"
            : "text-neutral-400 hover:text-neutral-600 hover:bg-neutral-50"
        )}
        title="Listing Settings"
      >
        <Settings size={14} />
      </button>
    )}
  </div>
)
```

- [ ] **Step 3: Verify in browser**

Open an Etsy Digital Listings table. The gear icon should appear pinned to the right of the tabs bar. It should not appear in generic tables (no `onSettingsClick` prop passed yet — that comes in Task 6).

- [ ] **Step 4: Commit**

```bash
git add components/app/ViewTabs.tsx
git commit -m "feat(viewtabs): add gear icon for Etsy listing settings"
```

---

## Task 6: TableView — settings state + panel wiring

**Files:**
- Modify: `components/table/TableView.tsx`

`TableView` manages whether the settings panel is open. When open, it renders `ListingSettingsPanel` instead of the grid area.

- [ ] **Step 1: Add `showSettings` state and pass gear props to ViewTabs**

In `TableView`, find where `activeBaseIntegration` is used. Add:

```typescript
const [showSettings, setShowSettings] = useState(false)

// Reset settings panel when table changes
useEffect(() => { setShowSettings(false) }, [activeTableId])
```

Update the `<ViewTabs>` call to pass the new props when integration is etsy:

```tsx
<ViewTabs
  views={views}
  onViewAdded={handleViewAdded}
  onViewRenamed={handleViewRenamed}
  onViewDeleted={handleViewDeleted}
  onViewsReordered={handleViewsReordered}
  onSettingsClick={activeBaseIntegration === "etsy" ? () => setShowSettings((v) => !v) : undefined}
  settingsOpen={showSettings}
/>
```

- [ ] **Step 2: Conditionally render settings panel vs grid area**

Find the section that renders the current view (the `if (activeView?.type === "grid")` block etc.). Wrap it:

```tsx
{showSettings && activeBaseId ? (
  <ListingSettingsPanel
    baseId={activeBaseId}
    fields={fields}
    onClose={() => setShowSettings(false)}
  />
) : (
  /* existing view render code — unchanged */
)}
```

Add the import at the top:
```typescript
import { ListingSettingsPanel } from "@/components/listing-settings/ListingSettingsPanel"
```

- [ ] **Step 3: Handle the `etsy:new-listing` event from the sidebar**

Inside `TableView`, listen for the custom event from the sidebar "New Listing" button and add a new row:

```typescript
useEffect(() => {
  const handler = (e: Event) => {
    const { tableId } = (e as CustomEvent).detail
    if (tableId !== activeTableId) return
    addRecord()
  }
  window.addEventListener("etsy:new-listing", handler)
  return () => window.removeEventListener("etsy:new-listing", handler)
}, [activeTableId, addRecord])
```

- [ ] **Step 4: Verify gear icon toggles something (panel is empty for now — ok)**

Click the gear icon on a Digital Listings table. The grid area should hide and show a blank area (the empty `ListingSettingsPanel` shell from Task 7). Clicking gear again returns to the grid.

- [ ] **Step 5: Commit**

```bash
git add components/table/TableView.tsx
git commit -m "feat(table): wire settings panel toggle to ViewTabs gear icon"
```

---

## Task 7: ListingSettingsPanel shell + nav

**Files:**
- Create: `components/listing-settings/ListingSettingsPanel.tsx`

The panel has a left nav (Store Defaults / Categories / Templates) and a right content area.

- [ ] **Step 1: Create the panel component**

```tsx
"use client"

import { useCallback, useEffect, useState } from "react"
import { X, SlidersHorizontal, Tag, Library } from "lucide-react"
import { toast } from "sonner"
import { cn } from "@/lib/utils"
import { emptySettings } from "@/types/listing-settings"
import type { ListingSettings } from "@/types/listing-settings"
import type { Field } from "@/types/core"
import { StoreDefaultsSection } from "./StoreDefaultsSection"
import { CategoriesSection } from "./CategoriesSection"
import { TemplatesLibrary } from "./TemplatesLibrary"

type NavItem = "defaults" | "categories" | "templates"

const NAV: Array<{ id: NavItem; label: string; icon: React.ReactNode }> = [
  { id: "defaults",   label: "Store Defaults", icon: <SlidersHorizontal size={14} /> },
  { id: "categories", label: "Categories",     icon: <Tag size={14} /> },
  { id: "templates",  label: "Templates",      icon: <Library size={14} /> },
]

interface Props {
  baseId: string
  fields: Field[]
  onClose: () => void
}

export function ListingSettingsPanel({ baseId, fields, onClose }: Props) {
  const [active, setActive] = useState<NavItem>("defaults")
  const [settings, setSettings] = useState<ListingSettings>(emptySettings())
  const [saving, setSaving] = useState(false)

  const load = useCallback(async () => {
    const res = await fetch(`/api/listing-settings/${baseId}`)
    if (res.ok) setSettings(await res.json())
  }, [baseId])

  useEffect(() => { load() }, [load])

  const save = useCallback(async (patch: Partial<ListingSettings>) => {
    setSaving(true)
    try {
      const res = await fetch(`/api/listing-settings/${baseId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      })
      if (!res.ok) { toast.error("Failed to save settings"); return }
      const updated: ListingSettings = await res.json()
      setSettings(updated)
    } finally {
      setSaving(false)
    }
  }, [baseId])

  return (
    <div className="flex flex-1 overflow-hidden">
      {/* Left nav */}
      <div className="w-44 border-r bg-neutral-50 flex flex-col shrink-0">
        <div className="px-3 py-3 border-b">
          <p className="text-xs font-semibold text-neutral-700">Listing Settings</p>
          {saving && <p className="text-[10px] text-neutral-400 mt-0.5">Saving…</p>}
        </div>
        <nav className="flex-1 p-2 space-y-0.5">
          {NAV.map((item) => (
            <button
              key={item.id}
              onClick={() => setActive(item.id)}
              className={cn(
                "w-full flex items-center gap-2 px-2 py-1.5 rounded text-xs transition-colors",
                active === item.id
                  ? "bg-orange-50 text-orange-600 font-medium"
                  : "text-neutral-600 hover:bg-neutral-100"
              )}
            >
              {item.icon}
              {item.label}
            </button>
          ))}
        </nav>
        <div className="p-2 border-t">
          <button
            onClick={onClose}
            className="w-full flex items-center gap-2 px-2 py-1.5 rounded text-xs text-neutral-500 hover:bg-neutral-100"
          >
            <X size={13} /> Close settings
          </button>
        </div>
      </div>

      {/* Right content */}
      <div className="flex-1 overflow-y-auto">
        {active === "defaults" && (
          <StoreDefaultsSection settings={settings} onSave={save} />
        )}
        {active === "categories" && (
          <CategoriesSection settings={settings} fields={fields} onSave={save} />
        )}
        {active === "templates" && (
          <TemplatesLibrary settings={settings} onSave={save} />
        )}
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Verify panel opens with nav**

Click gear icon on a Digital Listings table. The panel shell should appear with Store Defaults / Categories / Templates nav. Each section shows an empty placeholder (created in subsequent tasks).

- [ ] **Step 3: Commit**

```bash
git add components/listing-settings/ListingSettingsPanel.tsx
git commit -m "feat(settings): add ListingSettingsPanel shell with nav"
```

---

## Task 8: StoreDefaultsSection

**Files:**
- Create: `components/listing-settings/StoreDefaultsSection.tsx`

Lets the user set global field defaults (pre-filled + hidden in creation), toggle global auto-run, and set batch size.

- [ ] **Step 1: Create the component**

```tsx
"use client"

import { useState } from "react"
import type { ListingSettings } from "@/types/listing-settings"

interface Props {
  settings: ListingSettings
  onSave: (patch: Partial<ListingSettings>) => Promise<void>
}

const EDITABLE_DEFAULTS = [
  { name: "Who Made",  type: "text" as const },
  { name: "When Made", type: "text" as const },
  { name: "Quantity",  type: "number" as const },
]

export function StoreDefaultsSection({ settings, onSave }: Props) {
  const [draft, setDraft] = useState({ ...settings })

  const update = <K extends keyof ListingSettings>(key: K, value: ListingSettings[K]) => {
    setDraft((prev) => ({ ...prev, [key]: value }))
  }

  const updateDefault = (fieldName: string, value: string | number | boolean | null) => {
    setDraft((prev) => ({
      ...prev,
      fieldDefaults: { ...prev.fieldDefaults, [fieldName]: value },
    }))
  }

  const handleSave = () => {
    onSave({
      fieldDefaults: draft.fieldDefaults,
      globalAutoRun: draft.globalAutoRun,
      batchSize: draft.batchSize,
      defaultCategoryId: draft.defaultCategoryId,
    })
  }

  return (
    <div className="p-6 max-w-xl space-y-6">
      <div>
        <h2 className="text-sm font-semibold text-neutral-800 mb-1">Store Defaults</h2>
        <p className="text-xs text-neutral-500">
          Fields with defaults are pre-filled silently and hidden from the grid unless overridden by a category.
        </p>
      </div>

      {/* Automation */}
      <section className="space-y-3">
        <h3 className="text-xs font-semibold text-neutral-600 uppercase tracking-wider">Automation</h3>
        <label className="flex items-center gap-3 cursor-pointer">
          <input
            type="checkbox"
            checked={draft.globalAutoRun}
            onChange={(e) => update("globalAutoRun", e.target.checked)}
            className="w-4 h-4 rounded accent-orange-500"
          />
          <div>
            <p className="text-xs font-medium text-neutral-700">Auto-run on trigger</p>
            <p className="text-[11px] text-neutral-400">
              When a category trigger fires, start generation automatically (can be overridden per category)
            </p>
          </div>
        </label>
        <div className="flex items-center gap-3">
          <label className="text-xs text-neutral-700 w-28 shrink-0">Batch size limit</label>
          <input
            type="number"
            min={1} max={12}
            value={draft.batchSize}
            onChange={(e) => update("batchSize", Math.min(12, Math.max(1, Number(e.target.value))))}
            className="w-20 text-xs border rounded px-2 py-1 outline-none focus:border-orange-400"
          />
          <span className="text-[11px] text-neutral-400">max 12</span>
        </div>
      </section>

      {/* Field defaults */}
      <section className="space-y-3">
        <h3 className="text-xs font-semibold text-neutral-600 uppercase tracking-wider">Field Defaults</h3>
        <div className="space-y-2">
          {Object.entries(draft.fieldDefaults).map(([name, value]) => (
            <div key={name} className="flex items-center gap-3">
              <span className="text-xs text-neutral-700 w-44 shrink-0">{name}</span>
              <input
                type={typeof value === "boolean" ? "checkbox" : typeof value === "number" ? "number" : "text"}
                checked={typeof value === "boolean" ? value : undefined}
                value={typeof value === "boolean" ? undefined : String(value ?? "")}
                onChange={(e) => {
                  if (typeof value === "boolean") updateDefault(name, e.target.checked)
                  else if (typeof value === "number") updateDefault(name, Number(e.target.value))
                  else updateDefault(name, e.target.value)
                }}
                className="flex-1 text-xs border rounded px-2 py-1 outline-none focus:border-orange-400 w-4 h-4"
              />
            </div>
          ))}
        </div>
        <p className="text-[11px] text-neutral-400">
          Defaults are applied globally. Category-level defaults override these.
        </p>
      </section>

      <button
        onClick={handleSave}
        className="px-4 py-1.5 text-xs bg-orange-500 text-white rounded hover:bg-orange-600 transition-colors"
      >
        Save defaults
      </button>
    </div>
  )
}
```

- [ ] **Step 2: Verify in browser**

Open settings panel → Store Defaults. Toggle auto-run, change batch size, change a field default → Save. Reload settings panel and confirm values persist.

- [ ] **Step 3: Commit**

```bash
git add components/listing-settings/StoreDefaultsSection.tsx
git commit -m "feat(settings): add Store Defaults section"
```

---

## Task 9: CategoriesSection — list and create

**Files:**
- Create: `components/listing-settings/CategoriesSection.tsx`

Shows the category list. Create / delete categories here. Clicking a category opens `CategoryEditor`.

- [ ] **Step 1: Create `CategoriesSection.tsx`**

```tsx
"use client"

import { useState } from "react"
import { Plus, Trash2, ChevronRight } from "lucide-react"
import { toast } from "sonner"
import { cn } from "@/lib/utils"
import { newCategory } from "@/types/listing-settings"
import type { ListingSettings, ListingCategory } from "@/types/listing-settings"
import type { Field } from "@/types/core"
import { CategoryEditor } from "./CategoryEditor"
import { ConfirmDialog } from "@/components/ui/ConfirmDialog"

interface Props {
  settings: ListingSettings
  fields: Field[]
  onSave: (patch: Partial<ListingSettings>) => Promise<void>
}

export function CategoriesSection({ settings, fields, onSave }: Props) {
  const [editing, setEditing] = useState<ListingCategory | null>(null)
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)

  const addCategory = async () => {
    const cat = newCategory()
    await onSave({ categories: [...settings.categories, cat] })
    setEditing(cat)
  }

  const deleteCategory = async (id: string) => {
    await onSave({ categories: settings.categories.filter((c) => c.id !== id) })
    if (editing?.id === id) setEditing(null)
  }

  const saveCategory = async (updated: ListingCategory) => {
    await onSave({
      categories: settings.categories.map((c) => c.id === updated.id ? updated : c),
    })
    setEditing(updated)
  }

  if (editing) {
    return (
      <CategoryEditor
        category={editing}
        fields={fields}
        settings={settings}
        onSave={saveCategory}
        onBack={() => setEditing(null)}
      />
    )
  }

  return (
    <div className="p-6 max-w-xl space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-sm font-semibold text-neutral-800">Categories</h2>
          <p className="text-xs text-neutral-500 mt-0.5">
            Each category is an automation profile — trigger, field roles, AI template, and publish rules.
          </p>
        </div>
        <button
          onClick={addCategory}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-orange-500 text-white rounded hover:bg-orange-600"
        >
          <Plus size={12} /> New category
        </button>
      </div>

      {settings.categories.length === 0 && (
        <div className="border-2 border-dashed rounded-lg p-8 text-center">
          <p className="text-xs text-neutral-400">No categories yet.</p>
          <p className="text-[11px] text-neutral-300 mt-1">Create one to define automation rules for a product type.</p>
        </div>
      )}

      <div className="space-y-1">
        {settings.categories.map((cat) => (
          <div
            key={cat.id}
            className="group flex items-center gap-3 p-3 rounded-lg border bg-white hover:border-orange-200 cursor-pointer transition-colors"
            onClick={() => setEditing(cat)}
          >
            <span className="text-base select-none">{cat.icon}</span>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium text-neutral-800">{cat.name}</p>
              <p className="text-[11px] text-neutral-400 truncate">
                Trigger: {cat.trigger.type.replace(/_/g, " ")} ·{" "}
                {cat.autoRun ? "Auto-run ON" : "Manual"}
              </p>
            </div>
            <ChevronRight size={14} className="text-neutral-300 group-hover:text-neutral-500 shrink-0" />
            <button
              className="opacity-0 group-hover:opacity-100 p-1 text-neutral-300 hover:text-red-500 rounded shrink-0"
              onClick={(e) => { e.stopPropagation(); setConfirmDeleteId(cat.id) }}
            >
              <Trash2 size={13} />
            </button>
          </div>
        ))}
      </div>

      {confirmDeleteId && (
        <ConfirmDialog
          title="Delete category?"
          description={`"${settings.categories.find((c) => c.id === confirmDeleteId)?.name}" and all its rules will be permanently deleted.`}
          onConfirm={() => { deleteCategory(confirmDeleteId); setConfirmDeleteId(null) }}
          onCancel={() => setConfirmDeleteId(null)}
        />
      )}
    </div>
  )
}
```

- [ ] **Step 2: Verify in browser**

Open settings → Categories. Click "New category" — a new category appears in the list. Click it to open the editor (placeholder for now). Click delete icon and confirm — category removed.

- [ ] **Step 3: Commit**

```bash
git add components/listing-settings/CategoriesSection.tsx
git commit -m "feat(settings): add Categories section with list and CRUD"
```

---

## Task 10: CategoryEditor — Identity + Trigger + Publish tabs

**Files:**
- Create: `components/listing-settings/CategoryEditor.tsx`
- Create: `components/listing-settings/TriggerConfig.tsx`

The editor has 5 tabs: Identity | Trigger | Fields | AI Template | Post-Process. This task covers Identity, Trigger, and Publish (the simpler tabs). Fields and AI Template come in Tasks 11–12.

- [ ] **Step 1: Create `TriggerConfig.tsx`**

```tsx
"use client"

import type { TriggerCondition, TriggerType } from "@/types/listing-settings"

const TRIGGER_TYPES: Array<{ value: TriggerType; label: string; hasFields: boolean; hasStatus: boolean }> = [
  { value: "field_filled",  label: "When a field is filled",           hasFields: true,  hasStatus: false },
  { value: "fields_filled", label: "When multiple fields are filled",  hasFields: true,  hasStatus: false },
  { value: "status_equals", label: "When Status equals a value",       hasFields: false, hasStatus: true  },
  { value: "row_created",   label: "When a row is created",            hasFields: false, hasStatus: false },
  { value: "manual",        label: "Manual only (Run button)",         hasFields: false, hasStatus: false },
]

const COMMON_FIELD_NAMES = ["Images", "Title", "Description", "Price", "Tags"]

interface Props {
  trigger: TriggerCondition
  onChange: (trigger: TriggerCondition) => void
}

export function TriggerConfig({ trigger, onChange }: Props) {
  const meta = TRIGGER_TYPES.find((t) => t.value === trigger.type)!

  return (
    <div className="space-y-3">
      <div>
        <label className="text-xs font-medium text-neutral-700 block mb-1">Trigger condition</label>
        <select
          value={trigger.type}
          onChange={(e) => onChange({ type: e.target.value as TriggerType })}
          className="w-full text-xs border rounded px-2 py-1.5 outline-none focus:border-orange-400"
        >
          {TRIGGER_TYPES.map((t) => (
            <option key={t.value} value={t.value}>{t.label}</option>
          ))}
        </select>
      </div>

      {meta.hasFields && (
        <div>
          <label className="text-xs font-medium text-neutral-700 block mb-1">
            {trigger.type === "fields_filled" ? "Fields (all must be filled)" : "Field"}
          </label>
          <div className="space-y-1">
            {(trigger.fieldNames ?? ["Images"]).map((name, i) => (
              <div key={i} className="flex items-center gap-2">
                <select
                  value={name}
                  onChange={(e) => {
                    const names = [...(trigger.fieldNames ?? [])]
                    names[i] = e.target.value
                    onChange({ ...trigger, fieldNames: names })
                  }}
                  className="flex-1 text-xs border rounded px-2 py-1 outline-none focus:border-orange-400"
                >
                  {COMMON_FIELD_NAMES.map((f) => <option key={f} value={f}>{f}</option>)}
                </select>
                {trigger.type === "fields_filled" && (
                  <button
                    onClick={() => onChange({ ...trigger, fieldNames: (trigger.fieldNames ?? []).filter((_, idx) => idx !== i) })}
                    className="text-neutral-300 hover:text-red-500 text-xs"
                  >✕</button>
                )}
              </div>
            ))}
            {trigger.type === "fields_filled" && (
              <button
                onClick={() => onChange({ ...trigger, fieldNames: [...(trigger.fieldNames ?? []), "Images"] })}
                className="text-xs text-orange-500 hover:text-orange-700"
              >
                + Add field
              </button>
            )}
          </div>
        </div>
      )}

      {meta.hasStatus && (
        <div>
          <label className="text-xs font-medium text-neutral-700 block mb-1">Status value</label>
          <input
            value={trigger.statusValue ?? ""}
            onChange={(e) => onChange({ ...trigger, statusValue: e.target.value })}
            placeholder="e.g. Ready to Generate"
            className="w-full text-xs border rounded px-2 py-1.5 outline-none focus:border-orange-400"
          />
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Create `CategoryEditor.tsx`**

```tsx
"use client"

import { useState } from "react"
import { ArrowLeft, Save } from "lucide-react"
import { cn } from "@/lib/utils"
import type { ListingCategory, ListingSettings } from "@/types/listing-settings"
import type { Field } from "@/types/core"
import { TriggerConfig } from "./TriggerConfig"
import { FieldRoleTable } from "./FieldRoleTable"
import { AITemplateEditor } from "./AITemplateEditor"
import { DescriptionBlockEditor } from "./DescriptionBlockEditor"
import { PostProcessRules } from "./PostProcessRules"

type Tab = "identity" | "trigger" | "fields" | "ai" | "postprocess"

const TABS: Array<{ id: Tab; label: string }> = [
  { id: "identity",   label: "Identity" },
  { id: "trigger",    label: "Trigger" },
  { id: "fields",     label: "Fields" },
  { id: "ai",         label: "AI Template" },
  { id: "postprocess",label: "Post-Process" },
]

const ICON_OPTIONS = ["🖼️","🎨","✏️","🏷️","📦","🌟","💎","🎭","🖌️","📐"]
const COLOR_OPTIONS = ["#6366f1","#f97316","#22c55e","#3b82f6","#ec4899","#eab308","#14b8a6","#a855f7"]

interface Props {
  category: ListingCategory
  fields: Field[]
  settings: ListingSettings
  onSave: (updated: ListingCategory) => Promise<void>
  onBack: () => void
}

export function CategoryEditor({ category, fields, settings, onSave, onBack }: Props) {
  const [draft, setDraft] = useState<ListingCategory>({ ...category })
  const [activeTab, setActiveTab] = useState<Tab>("identity")
  const [saving, setSaving] = useState(false)

  const update = <K extends keyof ListingCategory>(key: K, value: ListingCategory[K]) =>
    setDraft((prev) => ({ ...prev, [key]: value }))

  const handleSave = async () => {
    setSaving(true)
    try { await onSave(draft) } finally { setSaving(false) }
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 border-b bg-white shrink-0">
        <button onClick={onBack} className="text-neutral-400 hover:text-neutral-700">
          <ArrowLeft size={16} />
        </button>
        <span className="text-base select-none">{draft.icon}</span>
        <h2 className="text-sm font-semibold text-neutral-800 flex-1">{draft.name}</h2>
        <button
          onClick={handleSave}
          disabled={saving}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-orange-500 text-white rounded hover:bg-orange-600 disabled:opacity-50"
        >
          <Save size={12} /> {saving ? "Saving…" : "Save"}
        </button>
      </div>

      {/* Tabs */}
      <div className="flex gap-0.5 px-4 border-b bg-white shrink-0">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={cn(
              "px-3 py-2 text-xs border-b-2 transition-colors",
              activeTab === tab.id
                ? "border-orange-500 text-orange-600 font-medium"
                : "border-transparent text-neutral-500 hover:text-neutral-700"
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-5">

        {/* Identity */}
        {activeTab === "identity" && (
          <div className="max-w-md space-y-4">
            <div>
              <label className="text-xs font-medium text-neutral-700 block mb-1">Name</label>
              <input
                value={draft.name}
                onChange={(e) => update("name", e.target.value)}
                className="w-full text-xs border rounded px-2 py-1.5 outline-none focus:border-orange-400"
              />
            </div>

            <div>
              <label className="text-xs font-medium text-neutral-700 block mb-1">Icon</label>
              <div className="flex flex-wrap gap-1.5">
                {ICON_OPTIONS.map((icon) => (
                  <button
                    key={icon}
                    onClick={() => update("icon", icon)}
                    className={cn(
                      "w-8 h-8 text-base rounded border transition-colors",
                      draft.icon === icon ? "border-orange-400 bg-orange-50" : "border-neutral-200 hover:border-neutral-300"
                    )}
                  >
                    {icon}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="text-xs font-medium text-neutral-700 block mb-1">Color</label>
              <div className="flex gap-1.5">
                {COLOR_OPTIONS.map((color) => (
                  <button
                    key={color}
                    onClick={() => update("color", color)}
                    style={{ backgroundColor: color }}
                    className={cn(
                      "w-6 h-6 rounded-full border-2 transition-all",
                      draft.color === color ? "border-neutral-800 scale-110" : "border-transparent"
                    )}
                  />
                ))}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              {[
                { key: "shopSectionId" as const,   label: "Shop Section ID" },
                { key: "taxonomyId" as const,       label: "Taxonomy ID" },
                { key: "returnPolicyId" as const,   label: "Return Policy ID" },
                { key: "defaultPrice" as const,     label: "Default Price ($)" },
              ].map(({ key, label }) => (
                <div key={key}>
                  <label className="text-xs font-medium text-neutral-700 block mb-1">{label}</label>
                  <input
                    type="number"
                    value={draft[key] ?? ""}
                    onChange={(e) => update(key, e.target.value ? Number(e.target.value) : undefined)}
                    className="w-full text-xs border rounded px-2 py-1.5 outline-none focus:border-orange-400"
                  />
                </div>
              ))}
            </div>

            {/* Publish rules here for convenience */}
            <div className="pt-2 border-t space-y-3">
              <h3 className="text-xs font-semibold text-neutral-600 uppercase tracking-wider">Publish Rules</h3>
              <div className="flex items-center gap-3">
                <label className="text-xs text-neutral-700 w-32 shrink-0">Default state</label>
                <select
                  value={draft.publishState}
                  onChange={(e) => update("publishState", e.target.value as "draft" | "active")}
                  className="text-xs border rounded px-2 py-1 outline-none focus:border-orange-400"
                >
                  <option value="draft">Draft</option>
                  <option value="active">Active (publish immediately)</option>
                </select>
              </div>
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={draft.autoRun}
                  onChange={(e) => update("autoRun", e.target.checked)}
                  className="w-4 h-4 rounded accent-orange-500"
                />
                <span className="text-xs text-neutral-700">Auto-run automation for this category</span>
              </label>
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={draft.requireApproval}
                  onChange={(e) => update("requireApproval", e.target.checked)}
                  className="w-4 h-4 rounded accent-orange-500"
                />
                <span className="text-xs text-neutral-700">Require manual approval before publishing</span>
              </label>
            </div>
          </div>
        )}

        {activeTab === "trigger" && (
          <div className="max-w-md">
            <p className="text-xs text-neutral-500 mb-4">
              Define what starts the automation for rows in this category.
            </p>
            <TriggerConfig
              trigger={draft.trigger}
              onChange={(t) => update("trigger", t)}
            />
          </div>
        )}

        {activeTab === "fields" && (
          <FieldRoleTable
            fieldRoles={draft.fieldRoles}
            fields={fields}
            onChange={(roles) => update("fieldRoles", roles)}
          />
        )}

        {activeTab === "ai" && (
          <AITemplateEditor
            templateOverride={draft.templateOverride}
            descriptionBlocks={draft.descriptionBlocks}
            templates={settings.templates}
            selectedTemplateId={draft.templateId}
            onTemplateChange={(id) => update("templateId", id)}
            onOverrideChange={(v) => update("templateOverride", v)}
            onBlocksChange={(blocks) => update("descriptionBlocks", blocks)}
          />
        )}

        {activeTab === "postprocess" && (
          <PostProcessRules
            rules={draft.postProcessRules}
            fields={fields}
            onChange={(rules) => update("postProcessRules", rules)}
          />
        )}
      </div>
    </div>
  )
}
```

- [ ] **Step 3: Create empty placeholder stubs for tabs not yet built** (they'll be filled in Tasks 11–12)

```tsx
// components/listing-settings/FieldRoleTable.tsx
"use client"
import type { FieldRoleConfig } from "@/types/listing-settings"
import type { Field } from "@/types/core"
interface Props { fieldRoles: FieldRoleConfig[]; fields: Field[]; onChange: (roles: FieldRoleConfig[]) => void }
export function FieldRoleTable({ }: Props) {
  return <div className="p-4 text-xs text-neutral-400">Field role configuration — coming in next task</div>
}

// components/listing-settings/AITemplateEditor.tsx
"use client"
import type { DescriptionBlock, PromptTemplate } from "@/types/listing-settings"
interface Props {
  templateOverride?: string; descriptionBlocks: DescriptionBlock[]; templates: PromptTemplate[]
  selectedTemplateId?: string; onTemplateChange: (id: string) => void
  onOverrideChange: (v: string) => void; onBlocksChange: (b: DescriptionBlock[]) => void
}
export function AITemplateEditor({ }: Props) {
  return <div className="p-4 text-xs text-neutral-400">AI template editor — coming in next task</div>
}

// components/listing-settings/DescriptionBlockEditor.tsx
"use client"
import type { DescriptionBlock } from "@/types/listing-settings"
interface Props { blocks: DescriptionBlock[]; onChange: (blocks: DescriptionBlock[]) => void }
export function DescriptionBlockEditor({ }: Props) {
  return <div className="p-4 text-xs text-neutral-400">Description block editor — coming in next task</div>
}

// components/listing-settings/PostProcessRules.tsx
"use client"
import type { PostProcessRule } from "@/types/listing-settings"
import type { Field } from "@/types/core"
interface Props { rules: PostProcessRule[]; fields: Field[]; onChange: (rules: PostProcessRule[]) => void }
export function PostProcessRules({ }: Props) {
  return <div className="p-4 text-xs text-neutral-400">Post-process rules — coming in next task</div>
}

// components/listing-settings/TemplatesLibrary.tsx
"use client"
import type { ListingSettings } from "@/types/listing-settings"
interface Props { settings: ListingSettings; onSave: (patch: Partial<ListingSettings>) => Promise<void> }
export function TemplatesLibrary({ }: Props) {
  return <div className="p-4 text-xs text-neutral-400">Templates library — coming in next task</div>
}
```

- [ ] **Step 4: Verify in browser**

Open settings → Categories → New category → click it. The 5-tab editor opens. Identity tab has all fields. Trigger tab shows trigger config. Other tabs show placeholder text. Clicking Save updates the category in the list.

- [ ] **Step 5: Commit**

```bash
git add components/listing-settings/CategoryEditor.tsx components/listing-settings/TriggerConfig.tsx \
  components/listing-settings/FieldRoleTable.tsx components/listing-settings/AITemplateEditor.tsx \
  components/listing-settings/DescriptionBlockEditor.tsx components/listing-settings/PostProcessRules.tsx \
  components/listing-settings/TemplatesLibrary.tsx
git commit -m "feat(settings): CategoryEditor with Identity, Trigger, and Publish tabs (stubs for remaining)"
```

---

## Task 11: FieldRoleTable

**Files:**
- Modify: `components/listing-settings/FieldRoleTable.tsx`

A table where every field gets an assigned role. The existing table field list is the source — one row per field.

- [ ] **Step 1: Replace the stub with the real implementation**

```tsx
"use client"

import { useEffect, useState } from "react"
import { cn } from "@/lib/utils"
import type { FieldRole, FieldRoleConfig } from "@/types/listing-settings"
import type { Field } from "@/types/core"

const ROLES: FieldRole[] = ["trigger", "context", "generated", "default", "manual", "hidden"]

const ROLE_LABELS: Record<FieldRole, string> = {
  trigger:   "Trigger",
  context:   "Context",
  generated: "Generated",
  default:   "Default",
  manual:    "Manual",
  hidden:    "Hidden",
}

const ROLE_COLORS: Record<FieldRole, string> = {
  trigger:   "bg-red-50 text-red-600 border-red-200",
  context:   "bg-blue-50 text-blue-600 border-blue-200",
  generated: "bg-purple-50 text-purple-600 border-purple-200",
  default:   "bg-neutral-100 text-neutral-600 border-neutral-200",
  manual:    "bg-green-50 text-green-600 border-green-200",
  hidden:    "bg-neutral-50 text-neutral-400 border-neutral-100",
}

interface Props {
  fieldRoles: FieldRoleConfig[]
  fields: Field[]
  onChange: (roles: FieldRoleConfig[]) => void
}

export function FieldRoleTable({ fieldRoles, fields, onChange }: Props) {
  // Build a working map: fieldName → config (filled from existing roles or defaults)
  const [rows, setRows] = useState<FieldRoleConfig[]>(() => {
    const existing = Object.fromEntries(fieldRoles.map((r) => [r.fieldName, r]))
    return fields.map((f) => existing[f.name] ?? { fieldName: f.name, roles: ["manual"] })
  })

  useEffect(() => {
    const existing = Object.fromEntries(fieldRoles.map((r) => [r.fieldName, r]))
    setRows(fields.map((f) => existing[f.name] ?? { fieldName: f.name, roles: ["manual"] }))
  }, [fieldRoles, fields])

  const updateRow = (fieldName: string, patch: Partial<FieldRoleConfig>) => {
    const updated = rows.map((r) => r.fieldName === fieldName ? { ...r, ...patch } : r)
    setRows(updated)
    onChange(updated)
  }

  const toggleRole = (fieldName: string, role: FieldRole, exclusive: boolean) => {
    const row = rows.find((r) => r.fieldName === fieldName)!
    let roles: FieldRole[]
    if (exclusive) {
      // Single-role fields (can't be trigger+generated)
      roles = row.roles.includes(role) ? ["manual"] : [role]
    } else {
      roles = row.roles.includes(role)
        ? row.roles.filter((r) => r !== role) || ["manual"]
        : [...row.roles, role]
    }
    if (roles.length === 0) roles = ["manual"]
    updateRow(fieldName, { roles })
  }

  return (
    <div className="space-y-2">
      <p className="text-xs text-neutral-500 mb-3">
        Assign roles to each field. <strong>Trigger</strong> starts the automation.{" "}
        <strong>Context</strong> means the user provides a hint and AI generates from it.{" "}
        <strong>Generated</strong> means AI creates it from scratch.{" "}
        <strong>Default</strong> means a static value is pre-filled silently.{" "}
        <strong>Manual</strong> = user always fills it. <strong>Hidden</strong> = system-managed.
      </p>

      <div className="rounded-lg border overflow-hidden">
        <table className="w-full text-xs">
          <thead>
            <tr className="bg-neutral-50 border-b">
              <th className="text-left px-3 py-2 text-neutral-600 font-medium w-40">Field</th>
              <th className="text-left px-3 py-2 text-neutral-600 font-medium">Roles</th>
              <th className="text-left px-3 py-2 text-neutral-600 font-medium w-36">Default / Hint</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => (
              <tr key={row.fieldName} className={cn("border-b last:border-0", i % 2 === 0 ? "bg-white" : "bg-neutral-50/50")}>
                <td className="px-3 py-2 font-medium text-neutral-700">{row.fieldName}</td>
                <td className="px-3 py-2">
                  <div className="flex flex-wrap gap-1">
                    {ROLES.map((role) => (
                      <button
                        key={role}
                        onClick={() => toggleRole(row.fieldName, role, false)}
                        className={cn(
                          "px-1.5 py-0.5 rounded border text-[11px] transition-all",
                          row.roles.includes(role)
                            ? ROLE_COLORS[role]
                            : "bg-white text-neutral-300 border-neutral-200 hover:border-neutral-300 hover:text-neutral-500"
                        )}
                      >
                        {ROLE_LABELS[role]}
                      </button>
                    ))}
                  </div>
                </td>
                <td className="px-3 py-2">
                  {(row.roles.includes("default")) && (
                    <input
                      type="text"
                      value={String(row.defaultValue ?? "")}
                      onChange={(e) => updateRow(row.fieldName, { defaultValue: e.target.value })}
                      placeholder="default value"
                      className="w-full text-[11px] border rounded px-1.5 py-0.5 outline-none focus:border-orange-400"
                    />
                  )}
                  {row.roles.includes("context") && (
                    <input
                      type="text"
                      value={row.contextHint ?? ""}
                      onChange={(e) => updateRow(row.fieldName, { contextHint: e.target.value })}
                      placeholder="hint shown in grid"
                      className="w-full text-[11px] border rounded px-1.5 py-0.5 outline-none focus:border-orange-400"
                    />
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Verify in browser**

Category editor → Fields tab. Every field in the Digital Listings table should appear as a row. Click role buttons to toggle — active roles show colored badges. Default value input appears when "default" is toggled. Context hint input appears for "context" role.

- [ ] **Step 3: Commit**

```bash
git add components/listing-settings/FieldRoleTable.tsx
git commit -m "feat(settings): implement FieldRoleTable with per-field role assignment"
```

---

## Task 12: AITemplateEditor + DescriptionBlockEditor

**Files:**
- Modify: `components/listing-settings/AITemplateEditor.tsx`
- Modify: `components/listing-settings/DescriptionBlockEditor.tsx`

- [ ] **Step 1: Replace `AITemplateEditor.tsx` stub**

```tsx
"use client"

import { useState } from "react"
import { Info } from "lucide-react"
import { TEMPLATE_VARIABLES } from "@/types/listing-settings"
import type { DescriptionBlock, PromptTemplate } from "@/types/listing-settings"
import { DescriptionBlockEditor } from "./DescriptionBlockEditor"

interface Props {
  templateOverride?: string
  descriptionBlocks: DescriptionBlock[]
  templates: PromptTemplate[]
  selectedTemplateId?: string
  onTemplateChange: (id: string) => void
  onOverrideChange: (v: string) => void
  onBlocksChange: (blocks: DescriptionBlock[]) => void
}

export function AITemplateEditor({
  templateOverride, descriptionBlocks, templates, selectedTemplateId,
  onTemplateChange, onOverrideChange, onBlocksChange,
}: Props) {
  const [showVars, setShowVars] = useState(false)

  const baseTemplate = templates.find((t) => t.id === selectedTemplateId)

  return (
    <div className="max-w-2xl space-y-6">
      {/* Template library selection */}
      {templates.length > 0 && (
        <div>
          <label className="text-xs font-medium text-neutral-700 block mb-1">Base template (from library)</label>
          <select
            value={selectedTemplateId ?? ""}
            onChange={(e) => onTemplateChange(e.target.value)}
            className="w-full text-xs border rounded px-2 py-1.5 outline-none focus:border-orange-400"
          >
            <option value="">None — use inline prompt only</option>
            {templates.map((t) => (
              <option key={t.id} value={t.id}>{t.name}</option>
            ))}
          </select>
          {baseTemplate && (
            <p className="mt-1 text-[11px] text-neutral-400 bg-neutral-50 rounded p-2 font-mono whitespace-pre-wrap">
              {baseTemplate.prompt}
            </p>
          )}
        </div>
      )}

      {/* Inline prompt override */}
      <div>
        <div className="flex items-center gap-2 mb-1">
          <label className="text-xs font-medium text-neutral-700">
            {baseTemplate ? "Prompt override (takes precedence over base template)" : "AI prompt"}
          </label>
          <button
            onClick={() => setShowVars((v) => !v)}
            className="flex items-center gap-1 text-[11px] text-orange-500 hover:text-orange-700"
          >
            <Info size={11} /> Variables
          </button>
        </div>

        {showVars && (
          <div className="mb-2 p-2 rounded-lg bg-orange-50 border border-orange-100 space-y-1">
            {TEMPLATE_VARIABLES.map((v) => (
              <div key={v.name} className="flex items-start gap-2 text-[11px]">
                <code className="text-orange-600 font-mono shrink-0">{v.name}</code>
                <span className="text-neutral-500">{v.description}</span>
              </div>
            ))}
          </div>
        )}

        <textarea
          value={templateOverride ?? ""}
          onChange={(e) => onOverrideChange(e.target.value)}
          rows={8}
          placeholder={`Write your AI prompt here. Use variables like {{image_analysis}} and {{title_hint}}.

Example:
You are an expert Etsy seller. Based on the image and the hint "{{title_hint}}", write an SEO-optimized listing. Return JSON: { "title": "...", "tags": [...] }`}
          className="w-full text-xs border rounded px-3 py-2 outline-none focus:border-orange-400 font-mono resize-y"
        />
        <p className="text-[11px] text-neutral-400 mt-1">
          The prompt must return JSON matching the fields you want to generate.
        </p>
      </div>

      {/* Description block template */}
      <div>
        <label className="text-xs font-medium text-neutral-700 block mb-1">Description template</label>
        <p className="text-[11px] text-neutral-400 mb-3">
          Build the Description field from ordered blocks. <strong>Fixed</strong> blocks are verbatim text.{" "}
          <strong>AI</strong> blocks are filled by the model. <strong>Context var</strong> pulls a field value.
        </p>
        <DescriptionBlockEditor blocks={descriptionBlocks} onChange={onBlocksChange} />
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Replace `DescriptionBlockEditor.tsx` stub**

```tsx
"use client"

import { useState } from "react"
import { Plus, Trash2, GripVertical } from "lucide-react"
import { cn } from "@/lib/utils"
import { newBlock } from "@/types/listing-settings"
import type { DescriptionBlock } from "@/types/listing-settings"

const BLOCK_LABELS: Record<DescriptionBlock["type"], string> = {
  fixed:       "Fixed",
  ai:          "AI",
  context_var: "Context var",
}

const BLOCK_COLORS: Record<DescriptionBlock["type"], string> = {
  fixed:       "bg-neutral-50 border-neutral-200",
  ai:          "bg-purple-50 border-purple-200",
  context_var: "bg-blue-50 border-blue-200",
}

interface Props {
  blocks: DescriptionBlock[]
  onChange: (blocks: DescriptionBlock[]) => void
}

export function DescriptionBlockEditor({ blocks, onChange }: Props) {
  const [dragIdx, setDragIdx] = useState<number | null>(null)
  const [dragOverIdx, setDragOverIdx] = useState<number | null>(null)

  const addBlock = (type: DescriptionBlock["type"]) => {
    onChange([...blocks, newBlock(type)])
  }

  const updateBlock = (id: string, content: string) => {
    onChange(blocks.map((b) => b.id === id ? { ...b, content } : b))
  }

  const removeBlock = (id: string) => {
    onChange(blocks.filter((b) => b.id !== id))
  }

  const onDrop = (toIdx: number) => {
    if (dragIdx === null || dragIdx === toIdx) return
    const reordered = [...blocks]
    const [moved] = reordered.splice(dragIdx, 1)
    reordered.splice(toIdx, 0, moved)
    onChange(reordered)
    setDragIdx(null)
    setDragOverIdx(null)
  }

  return (
    <div className="space-y-2">
      {blocks.length === 0 && (
        <div className="border-2 border-dashed rounded-lg p-4 text-center">
          <p className="text-[11px] text-neutral-400">No blocks yet — add one below.</p>
        </div>
      )}

      {blocks.map((block, i) => (
        <div
          key={block.id}
          draggable
          onDragStart={() => setDragIdx(i)}
          onDragOver={(e) => { e.preventDefault(); setDragOverIdx(i) }}
          onDrop={() => onDrop(i)}
          onDragEnd={() => { setDragIdx(null); setDragOverIdx(null) }}
          className={cn(
            "flex gap-2 rounded-lg border p-2 transition-all",
            BLOCK_COLORS[block.type],
            dragOverIdx === i && dragIdx !== i && "ring-2 ring-orange-300"
          )}
        >
          <div className="cursor-grab text-neutral-300 hover:text-neutral-500 mt-1">
            <GripVertical size={14} />
          </div>
          <div className="flex-1 space-y-1.5">
            <div className="flex items-center gap-2">
              <span className={cn(
                "text-[10px] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded",
                block.type === "fixed" ? "text-neutral-500 bg-neutral-100" :
                block.type === "ai" ? "text-purple-600 bg-purple-100" :
                "text-blue-600 bg-blue-100"
              )}>
                {BLOCK_LABELS[block.type]}
              </span>
            </div>
            <textarea
              value={block.content}
              onChange={(e) => updateBlock(block.id, e.target.value)}
              rows={block.type === "fixed" ? 3 : 2}
              placeholder={
                block.type === "fixed" ? "Static text that always appears verbatim…" :
                block.type === "ai" ? "AI instructions for this block (e.g. Write a 3-sentence description of the product mood and use case)" :
                "Variable name, e.g. title_hint"
              }
              className="w-full text-xs bg-transparent border-0 outline-none resize-y placeholder:text-neutral-300"
            />
          </div>
          <button
            onClick={() => removeBlock(block.id)}
            className="text-neutral-300 hover:text-red-500 self-start mt-1 shrink-0"
          >
            <Trash2 size={13} />
          </button>
        </div>
      ))}

      <div className="flex gap-2 pt-1">
        {(["fixed", "ai", "context_var"] as DescriptionBlock["type"][]).map((type) => (
          <button
            key={type}
            onClick={() => addBlock(type)}
            className={cn(
              "flex items-center gap-1 px-2 py-1 rounded text-[11px] border transition-colors",
              type === "fixed" ? "border-neutral-200 text-neutral-600 hover:bg-neutral-50" :
              type === "ai" ? "border-purple-200 text-purple-600 hover:bg-purple-50" :
              "border-blue-200 text-blue-600 hover:bg-blue-50"
            )}
          >
            <Plus size={11} /> {BLOCK_LABELS[type]}
          </button>
        ))}
      </div>
    </div>
  )
}
```

- [ ] **Step 3: Verify in browser**

Category editor → AI Template tab. Add blocks of all three types — they appear with correct colors. Drag to reorder. Type in textarea. Variable reference panel toggles. All changes persist when Save is clicked.

- [ ] **Step 4: Commit**

```bash
git add components/listing-settings/AITemplateEditor.tsx components/listing-settings/DescriptionBlockEditor.tsx
git commit -m "feat(settings): implement AI template editor and description block editor"
```

---

## Task 13: PostProcessRules

**Files:**
- Modify: `components/listing-settings/PostProcessRules.tsx`

- [ ] **Step 1: Replace stub with real implementation**

```tsx
"use client"

import { Plus, Trash2 } from "lucide-react"
import { newPostProcessRule } from "@/types/listing-settings"
import type { PostProcessRule } from "@/types/listing-settings"
import type { Field } from "@/types/core"

const RULE_TYPES: Array<{ value: PostProcessRule["type"]; label: string; valuePlaceholder: string; hasReplacement: boolean }> = [
  { value: "append_tags",     label: "Always include tags",   valuePlaceholder: "tag1, tag2, tag3", hasReplacement: false },
  { value: "exclude_tags",    label: "Always exclude tags",   valuePlaceholder: "tag1, tag2, tag3", hasReplacement: false },
  { value: "max_chars",       label: "Max characters",        valuePlaceholder: "140",              hasReplacement: false },
  { value: "capitalize_first",label: "Capitalize first word", valuePlaceholder: "(no value needed)", hasReplacement: false },
  { value: "regex_replace",   label: "Regex find/replace",    valuePlaceholder: "pattern",          hasReplacement: true  },
]

interface Props {
  rules: PostProcessRule[]
  fields: Field[]
  onChange: (rules: PostProcessRule[]) => void
}

export function PostProcessRules({ rules, fields, onChange }: Props) {
  const add = () => onChange([...rules, newPostProcessRule(fields[0]?.name ?? "Tags")])
  const remove = (id: string) => onChange(rules.filter((r) => r.id !== id))
  const update = (id: string, patch: Partial<PostProcessRule>) =>
    onChange(rules.map((r) => r.id === id ? { ...r, ...patch } : r))

  return (
    <div className="max-w-2xl space-y-4">
      <p className="text-xs text-neutral-500">
        Rules run after AI generation. Applied in order — top to bottom.
      </p>

      {rules.length === 0 && (
        <div className="border-2 border-dashed rounded-lg p-4 text-center">
          <p className="text-[11px] text-neutral-400">No rules yet.</p>
        </div>
      )}

      <div className="space-y-2">
        {rules.map((rule) => {
          const meta = RULE_TYPES.find((t) => t.value === rule.type)!
          return (
            <div key={rule.id} className="flex items-start gap-2 p-2 rounded-lg border bg-white">
              <div className="flex-1 grid grid-cols-3 gap-2">
                {/* Field */}
                <select
                  value={rule.fieldName}
                  onChange={(e) => update(rule.id, { fieldName: e.target.value })}
                  className="text-xs border rounded px-1.5 py-1 outline-none focus:border-orange-400"
                >
                  {fields.map((f) => <option key={f.id} value={f.name}>{f.name}</option>)}
                </select>
                {/* Rule type */}
                <select
                  value={rule.type}
                  onChange={(e) => update(rule.id, { type: e.target.value as PostProcessRule["type"] })}
                  className="text-xs border rounded px-1.5 py-1 outline-none focus:border-orange-400"
                >
                  {RULE_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
                </select>
                {/* Value */}
                <input
                  value={rule.value}
                  onChange={(e) => update(rule.id, { value: e.target.value })}
                  placeholder={meta.valuePlaceholder}
                  className="text-xs border rounded px-1.5 py-1 outline-none focus:border-orange-400"
                />
                {/* Replacement (regex only) */}
                {meta.hasReplacement && (
                  <input
                    value={rule.replacement ?? ""}
                    onChange={(e) => update(rule.id, { replacement: e.target.value })}
                    placeholder="replacement"
                    className="col-start-3 text-xs border rounded px-1.5 py-1 outline-none focus:border-orange-400"
                  />
                )}
              </div>
              <button onClick={() => remove(rule.id)} className="text-neutral-300 hover:text-red-500 mt-1 shrink-0">
                <Trash2 size={13} />
              </button>
            </div>
          )
        })}
      </div>

      <button
        onClick={add}
        className="flex items-center gap-1 text-xs text-orange-500 hover:text-orange-700"
      >
        <Plus size={12} /> Add rule
      </button>
    </div>
  )
}
```

- [ ] **Step 2: Verify in browser**

Category editor → Post-Process tab. Add rules, pick field, pick type, enter value. Delete rules. All changes persist.

- [ ] **Step 3: Commit**

```bash
git add components/listing-settings/PostProcessRules.tsx
git commit -m "feat(settings): implement PostProcessRules editor"
```

---

## Task 14: TemplatesLibrary

**Files:**
- Modify: `components/listing-settings/TemplatesLibrary.tsx`

A reusable prompt template store. Categories reference these by ID and can override.

- [ ] **Step 1: Replace stub with real implementation**

```tsx
"use client"

import { useState } from "react"
import { Plus, Trash2, ChevronDown, ChevronRight } from "lucide-react"
import { v4 as uuid } from "uuid"
import type { PromptTemplate, ListingSettings } from "@/types/listing-settings"
import { TEMPLATE_VARIABLES } from "@/types/listing-settings"
import { ConfirmDialog } from "@/components/ui/ConfirmDialog"

interface Props {
  settings: ListingSettings
  onSave: (patch: Partial<ListingSettings>) => Promise<void>
}

function newTemplate(): PromptTemplate {
  return {
    id: uuid(),
    name: "New Template",
    description: "",
    prompt: "",
  }
}

export function TemplatesLibrary({ settings, onSave }: Props) {
  const [expanded, setExpanded] = useState<string | null>(null)
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)
  const [drafts, setDrafts] = useState<Record<string, PromptTemplate>>({})

  const startEdit = (t: PromptTemplate) => {
    setDrafts((prev) => ({ ...prev, [t.id]: { ...t } }))
    setExpanded(t.id)
  }

  const updateDraft = (id: string, patch: Partial<PromptTemplate>) => {
    setDrafts((prev) => ({ ...prev, [id]: { ...prev[id], ...patch } }))
  }

  const saveTemplate = async (id: string) => {
    const draft = drafts[id]
    if (!draft) return
    await onSave({ templates: settings.templates.map((t) => t.id === id ? draft : t) })
    setExpanded(null)
  }

  const addTemplate = async () => {
    const t = newTemplate()
    await onSave({ templates: [...settings.templates, t] })
    startEdit(t)
  }

  const deleteTemplate = async (id: string) => {
    await onSave({ templates: settings.templates.filter((t) => t.id !== id) })
  }

  return (
    <div className="p-6 max-w-2xl space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-sm font-semibold text-neutral-800">Templates Library</h2>
          <p className="text-xs text-neutral-500 mt-0.5">
            Reusable AI prompts. Categories can inherit a base template and override specific parts.
          </p>
        </div>
        <button
          onClick={addTemplate}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-orange-500 text-white rounded hover:bg-orange-600"
        >
          <Plus size={12} /> New template
        </button>
      </div>

      {settings.templates.length === 0 && (
        <div className="border-2 border-dashed rounded-lg p-8 text-center">
          <p className="text-xs text-neutral-400">No templates yet.</p>
        </div>
      )}

      <div className="space-y-2">
        {settings.templates.map((t) => {
          const draft = drafts[t.id] ?? t
          const isOpen = expanded === t.id
          return (
            <div key={t.id} className="rounded-lg border bg-white overflow-hidden">
              <div
                className="flex items-center gap-2 px-3 py-2.5 cursor-pointer hover:bg-neutral-50"
                onClick={() => isOpen ? setExpanded(null) : startEdit(t)}
              >
                {isOpen ? <ChevronDown size={13} className="text-neutral-400" /> : <ChevronRight size={13} className="text-neutral-400" />}
                <span className="flex-1 text-xs font-medium text-neutral-800">{t.name}</span>
                {t.description && (
                  <span className="text-[11px] text-neutral-400 truncate max-w-xs">{t.description}</span>
                )}
                <button
                  onClick={(e) => { e.stopPropagation(); setConfirmDeleteId(t.id) }}
                  className="text-neutral-300 hover:text-red-500 ml-2 shrink-0"
                >
                  <Trash2 size={13} />
                </button>
              </div>

              {isOpen && (
                <div className="px-4 pb-4 space-y-3 border-t bg-white">
                  <div className="pt-3 grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs font-medium text-neutral-700 block mb-1">Name</label>
                      <input
                        value={draft.name}
                        onChange={(e) => updateDraft(t.id, { name: e.target.value })}
                        className="w-full text-xs border rounded px-2 py-1.5 outline-none focus:border-orange-400"
                      />
                    </div>
                    <div>
                      <label className="text-xs font-medium text-neutral-700 block mb-1">Description</label>
                      <input
                        value={draft.description}
                        onChange={(e) => updateDraft(t.id, { description: e.target.value })}
                        className="w-full text-xs border rounded px-2 py-1.5 outline-none focus:border-orange-400"
                      />
                    </div>
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="text-xs font-medium text-neutral-700">Prompt</label>
                      <details className="text-[11px] text-orange-500 cursor-pointer">
                        <summary>Available variables</summary>
                        <div className="absolute z-10 mt-1 p-2 rounded-lg bg-orange-50 border border-orange-100 space-y-1 text-[11px] w-72">
                          {TEMPLATE_VARIABLES.map((v) => (
                            <div key={v.name} className="flex items-start gap-2">
                              <code className="text-orange-600 font-mono shrink-0">{v.name}</code>
                              <span className="text-neutral-500">{v.description}</span>
                            </div>
                          ))}
                        </div>
                      </details>
                    </div>
                    <textarea
                      value={draft.prompt}
                      onChange={(e) => updateDraft(t.id, { prompt: e.target.value })}
                      rows={6}
                      className="w-full text-xs border rounded px-2 py-1.5 outline-none focus:border-orange-400 font-mono resize-y"
                    />
                  </div>

                  <div className="flex gap-2">
                    <button
                      onClick={() => saveTemplate(t.id)}
                      className="px-3 py-1.5 text-xs bg-orange-500 text-white rounded hover:bg-orange-600"
                    >
                      Save template
                    </button>
                    <button
                      onClick={() => setExpanded(null)}
                      className="px-3 py-1.5 text-xs text-neutral-500 hover:bg-neutral-100 rounded"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}
            </div>
          )
        })}
      </div>

      {confirmDeleteId && (
        <ConfirmDialog
          title="Delete template?"
          description="Any categories using this template will fall back to their inline prompt."
          onConfirm={() => { deleteTemplate(confirmDeleteId); setConfirmDeleteId(null) }}
          onCancel={() => setConfirmDeleteId(null)}
        />
      )}
    </div>
  )
}
```

- [ ] **Step 2: Verify in browser**

Settings → Templates. Create a template, expand it, write a prompt, save. Delete with confirmation. Templates created here appear in the Category Editor AI Template tab's "Base template" dropdown.

- [ ] **Step 3: Commit**

```bash
git add components/listing-settings/TemplatesLibrary.tsx
git commit -m "feat(settings): implement Templates Library"
```

---

## Task 15: End-to-end verification

- [ ] **Step 1: Full walkthrough**

1. Create a Space → seed an Etsy Store
2. Open Digital Listings table — confirm Images, Category, Automation State columns are present
3. Click gear icon → settings panel opens
4. Store Defaults: toggle auto-run, change batch size, change a default → Save → reload and confirm values
5. Categories: create "Digital Wall Art" category
   - Identity: name, icon, color, default price $4.99
   - Trigger: "When Images is filled"
   - Fields: set Images = Trigger+Context, Title = Context, Description = Generated, Price = Default ($4.99), Tags = Generated, all others = appropriate roles
   - AI Template: write a prompt, add 3 description blocks (AI + Fixed + AI), save
   - Post-Process: add "append_tags" rule for Tags
6. Templates: create "Digital Art Base" template → verify it appears in Category → AI Template dropdown
7. Sidebar: click "New Listing" → confirm a blank row is added to the Digital Listings table

- [ ] **Step 2: Check for TypeScript errors**

```bash
npx tsc --noEmit
```
Expected: 0 errors.

- [ ] **Step 3: Final commit**

```bash
git add -A
git commit -m "feat: listing settings UI complete — categories, field roles, AI templates, description blocks, post-process rules"
```

---

## What's Next

**Plan 2: Automation Engine** covers:
- Background automation runner (detect → pre-fill → generate → post-process → publish)
- Grid row state indicators (idle/queued/generating/error dots)
- Toolbar Run / Stop / Retry buttons with progress counter
- Live cell updates as generation streams in
- Category auto-detection from image (AI classify step 0)
- Wiring the existing `POST /api/ai/generate-listing` into the new template+block system
