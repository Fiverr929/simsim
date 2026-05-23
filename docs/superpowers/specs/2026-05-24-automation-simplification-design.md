# Automation Simplification — Design Spec
_Date: 2026-05-24_

## Problem

The current Listing Settings panel is too complex for what it does:
- 3-section left nav (Store Defaults, Categories, Templates)
- CategoryEditor with 5 tabs per category (Identity, Trigger, Fields, AI Template, Post-Process)
- Concepts like FieldRoleTable, DescriptionBlocks, TemplatesLibrary, and PostProcessRules add friction without proportional value
- Categories are JSON blobs embedded in `Base.config` — hard to inspect, migrate, or reason about

## Goal

Replace the current system with a **NocoDB/Airtable-style Automations model**: each automation is a named, toggleable trigger → filter → actions chain. Users think in terms of "what starts this" and "what does it do", not "what category profile am I editing".

## New Data Model

```typescript
// types/automation.ts

type AutomationTriggerType = "field_filled" | "row_created" | "manual"

interface AutomationTrigger {
  type: AutomationTriggerType
  fieldName?: string   // required for field_filled
}

interface AutomationFilter {
  fieldName: string    // e.g. "Category"
  value: string        // e.g. "Art Print"
}

type ActionType = "generate_ai" | "publish_etsy" | "set_field"

interface GenerateAIAction {
  type: "generate_ai"
  prompt: string               // uses {{field_name}} references
  writeToFields: string[]      // field names AI output is mapped to
}

interface PublishEtsyAction {
  type: "publish_etsy"
  taxonomyId?: number
  shopSectionId?: number
  returnPolicyId?: number
  defaultPrice?: number
  publishState: "draft" | "active"
  requireApproval: boolean
}

interface SetFieldAction {
  type: "set_field"
  fieldName: string
  value: string
}

type AutomationAction = GenerateAIAction | PublishEtsyAction | SetFieldAction

interface Automation {
  id: string
  name: string
  active: boolean
  trigger: AutomationTrigger
  filter?: AutomationFilter
  actions: AutomationAction[]
}
```

Automations are stored as a JSON array in `Base.config.automations: Automation[]`. No new DB table needed — keeps migration simple.

## What Is Eliminated

| Removed | Why |
|---------|-----|
| `FieldRoleTable` (6 roles per field) | Fields are just referenced via `{{name}}` in the prompt |
| `DescriptionBlocks` | Handled inline in the AI prompt |
| `TemplatesLibrary` | Each automation has its own prompt; no cross-category sharing needed |
| `PostProcessRules` | Handled via prompt instructions or a `set_field` action |
| `fieldDefaults` (store-level) | Replaced by `set_field` actions per automation |
| `ListingSettings` 3-section nav | Replaced by single Automations panel |
| `CategoryEditor` 5 tabs | Replaced by linear editor |

The `Category` singleSelect column on rows still exists — it's just used as a filter condition (`filter: { fieldName: "Category", value: "Art Print" }`), not as the config container.

## New UI

### Automations Panel (replaces Listing Settings panel)

```
Automations                              [+ New]
──────────────────────────────────────────────────
● Generate Art Print listing
  When Images filled · Category = Art Print

● Generate Digital Download listing
  When Images filled · Category = Digital

○ Publish approved listings
  When Status = Review
──────────────────────────────────────────────────
Global: Batch size [10 ▼]
```

### Automation Editor (replaces CategoryEditor with 5 tabs)

Single scrollable form:

```
← Generate Art Print listing         [● Active]

TRIGGER
  When [Images ▼] is filled

FILTER  (optional)
  Only if [Category ▼] = "Art Print"

ACTIONS
  ┌─ 1. Generate with AI ──────────────────────┐
  │  Prompt:                                    │
  │  [textarea — {{field_name}} for references] │
  │  Write results to: [Title] [Tags] [Desc]    │
  └─────────────────────────────────────────────┘
  ┌─ 2. Publish to Etsy ───────────────────────┐
  │  Taxonomy: [search…]                        │
  │  Shop Section: [dropdown]                   │
  │  Return Policy: [dropdown]                  │
  │  Default Price: [number]                    │
  │  Publish as: ○ Draft  ● Active              │
  │  ☐ Require approval before publishing       │
  └─────────────────────────────────────────────┘
  [+ Add action: Generate AI | Publish to Etsy | Set field]

[Save]
```

## Updated Automation Engine

The `run-row` API reads the matched automation instead of a `ListingCategory`:

1. Resolve which automation applies to this row (match trigger + filter)
2. Execute actions in order:
   - `generate_ai`: build prompt with `{{field_name}}` substitution from row data, call Gemini, write output to `writeToFields`
   - `publish_etsy`: read Etsy metadata from action config + row fields, call publish API
   - `set_field`: write static value to field
3. Existing batch orchestration, abort, and progress tracking in `TableView` unchanged

Trigger evaluation (for future auto-run): check `automation.trigger.fieldName` against changed field, then apply `automation.filter` against row data.

## Migration

Existing `ListingSettings.categories[]` are converted at read-time to the new `Automation[]` shape. A one-time migration helper maps `ListingCategory` → `Automation`:
- `trigger` → `automation.trigger`
- `fieldRoles` → `generate_ai.writeToFields` (generated roles) + prompt context hints
- `templateOverride` → `generate_ai.prompt`
- Etsy fields → `publish_etsy` action
- `postProcessRules` → dropped (prompt handles this)
- `descriptionBlocks` → folded into prompt

## What Stays Unchanged

- `prisma/schema.prisma` — no new models
- `hooks/useRecords.ts` + `patchLocalRecord`
- `AutomationToolbar` Run/Stop/Retry controls
- Batch orchestration in `TableView`
- Etsy publish API (`/api/etsy/publish`)
- `run-row` API structure (updated internals only)

## Files Created / Modified

**New:**
- `types/automation.ts` — new type definitions
- `components/automations/AutomationsPanel.tsx` — list + global batch size
- `components/automations/AutomationEditor.tsx` — linear scrollable form
- `components/automations/actions/GenerateAIAction.tsx`
- `components/automations/actions/PublishEtsyAction.tsx`
- `components/automations/actions/SetFieldAction.tsx`
- `app/api/automations/[baseId]/route.ts` — GET/PATCH automations

**Updated:**
- `app/api/automation/run-row/route.ts` — reads `Automation` instead of `ListingCategory`
- `app/api/bases/route.ts` / `listing-settings` route — migration logic
- `components/app/BaseSidebar.tsx` — swap "Listing Settings" button for "Automations"
- `types/core.ts` — add `automations` to `BaseConfig`

**Deleted:**
- `components/listing-settings/` — entire directory (7 files)
- `types/listing-settings.ts` — replaced by `types/automation.ts`

## Success Criteria

- Can create an automation with trigger + optional filter + actions in under 60 seconds
- Existing category-based runs still work (migration preserves behavior)
- No regression in batch run, abort, progress, or Etsy publish flow
- Listing Settings panel is gone; Automations panel is in its place
