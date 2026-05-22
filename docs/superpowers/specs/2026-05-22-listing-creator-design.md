# Listing Creator — Design Spec

**Date:** 2026-05-22
**Status:** Approved
**Scope:** Digital listings (Physical follows same system, later)

---

## Overview

The grid is the listing creator, the bulk tool, and the automation engine — all in one. No wizard, no separate creation flow. The user feeds images into rows; the automation fills the rest based on rules configured in Listing Settings.

Single listing and bulk listing use the exact same interface.

---

## 1. Grid as Automation Canvas

Every row in a Digital or Physical Listings table is a listing job with a **state**:

```
idle → queued → detecting → generating → review → published → error
```

State is shown as a small inline indicator on the row (colored dot in the row header). No separate panel needed — the grid is the dashboard.

### Images column

- Pinned to position 0 (leftmost)
- Supports multi-image upload per cell (drag & drop or click)
- Uploading an image is the default trigger — if auto-run is ON for the row's category, the row enters the queue immediately
- Each listing must have ≥1 image

### Category column

- Pinned to position 1 (after Images)
- Dropdown sourced from the categories defined in Listing Settings
- Assignment priority:
  1. Manual — user picks from dropdown (always wins)
  2. Auto-detect — AI classifies the image into a category (runs as step 0)
  3. Store default — fallback from Store Settings

### Toolbar actions (when rows are selected)

| Action | Behavior |
|---|---|
| **Run** | Triggers automation for selected rows |
| **Run All Pending** | Queues all rows in `idle` state |
| **Stop** | Cancels queued/in-progress rows |
| **Retry** | Re-runs failed rows from the failed step |
| Progress indicator | "Generating 4 / 10…" shown during a run |

### Batch limit

Max 10–12 rows per generation run (default 10, configurable in Store Settings). Additional rows stay queued and process in the next batch automatically.

### Live cell updates

As automation runs, cells fill in real time — no page refresh, no waiting. User can continue editing other rows while generation is in progress.

---

## 2. Field Role System

Every field in a category has a **role** that tells the automation what to do with it.

| Role | Behavior |
|---|---|
| **Trigger** | When this field gets a value, automation starts |
| **Context** | User provides a hint — AI reads it and generates FROM it (not just uses it verbatim) |
| **Generated** | AI creates this from scratch using images + context fields |
| **Default** | Static value silently pre-filled; field is hidden from the grid by default |
| **Manual** | User always fills this — AI never touches it |
| **Hidden** | System-managed (Etsy Listing ID, Automation State, etc.) |

A field can have combined roles. Example: Images = `Trigger + Context`.

### Title as context (key example)

When Title role = `Context`: user types "sunset mountain" into the Title cell → automation reads it and generates a proper SEO title like *"Serene Mountain Sunset Digital Art Print | Boho Wall Decor"*. The hint is consumed as input, not preserved as output.

When Title role = `Generated`: AI creates the title purely from image analysis, no hint needed.

---

## 3. Automation Workflow (per row)

When a row is triggered, it runs through these steps in order:

1. **Detect** — AI classifies the image into a category (skipped if category was manually set)
2. **Pre-fill** — apply all `Default` role fields for the matched category
3. **Generate** — run AI against the category's prompt template; fills all `Generated` fields
4. **Post-process** — apply per-field rules (tag appending, character limits, text transforms)
5. **Publish** — save as draft / activate / skip (per category's publish rule)

If any step fails, the row enters `error` state and shows which step failed. Retry re-runs from the failed step only.

---

## 4. Description Block Template

Description is a **block template** — configured once per category in Listing Settings, applied to every generated row.

### Block types

| Type | Behavior |
|---|---|
| **Fixed** | Static text written by the user — always appears verbatim |
| **AI** | A slot with generation instructions — AI fills this based on image + context |
| **Context Variable** | Pulls a value from a context field in the row (e.g. `{{title_hint}}`) |

### Example — "Digital Wall Art" category

```
[AI]     → "Write an engaging 3-sentence product description based on
            the image. Mention mood, style, and best room placement."

[Fixed]  → "📦 WHAT'S INCLUDED:"

[AI]     → "List the file formats and sizes included as a bullet list."

[Fixed]  → "———
            Instant digital download. No physical item shipped.
            Personal use only. Commercial license on request.
            © 2025 YIVEZ"
```

Blocks are ordered and draggable in the template editor. Different categories have entirely different block arrangements.

---

## 5. Listing Settings

Accessed via the **gear icon** pinned to the right corner of ViewTabs. Opens as a panel within the workspace (not a sidebar item). Three levels:

---

### 5a. Store Defaults

Global fallback values applied when no category rule overrides them.

- Field defaults (e.g. Who Made = "I did", When Made = "2020–2025", Is Taxable = true, Auto Renew = true, Quantity = 999)
- Global auto-run toggle (ON/OFF — can be overridden per category)
- Batch size limit (default 10, max 12)
- Default category for new rows

---

### 5b. Categories

Each category is a named automation profile. Configured in five sections:

#### Identity
- Name, icon, color
- Etsy Shop Section (mapped from store's actual sections)
- Taxonomy ID (searchable browser, not a raw number field)
- Return Policy
- Default price

#### Trigger
What condition starts the automation for rows in this category:

| Trigger type | Example |
|---|---|
| Field filled | "When Images is filled" |
| Multiple fields filled | "When Images AND Title are filled" |
| Status condition | "When Status = Ready to Generate" |
| Row created | Automation starts on row creation |
| Manual only | User always presses Run |

#### Field Configuration
A table listing every field with its assigned role for this category, plus a default/context value where applicable.

Example for "Digital Wall Art":

| Field | Role | Value / Note |
|---|---|---|
| Images | Trigger + Context | — |
| Category | Default | (this category) |
| Title | Context | User types hint; AI expands |
| Description | Generated | Uses block template |
| Tags | Generated | — |
| Price | Default | $4.99 |
| Quantity | Default | 999 |
| When Made | Default | 2020–2025 |
| Who Made | Default | I did |
| Is Taxable | Default | true |
| Auto Renew | Default | true |
| Shop Section ID | Default | (from category Identity) |
| Taxonomy ID | Default | (from category Identity) |
| Return Policy ID | Default | (from category Identity) |
| Styles | Generated | — |
| SKU | Manual | User fills |
| Etsy Listing ID | Hidden | Set after publish |
| Status | Hidden | Managed by workflow |
| Listing URL | Hidden | Set after publish |

#### AI Template
Prompt template for this category's generation step. Written in plain text with access to variables:

| Variable | Value |
|---|---|
| `{{title_hint}}` | Value from Title context field |
| `{{image_analysis}}` | AI's description of the uploaded image |
| `{{category_name}}` | This category's name |
| `{{style_tags}}` | Any styles already on the row |
| `{{shop_section}}` | Mapped shop section name |

An inline **variable reference panel** is shown beside the template editor so the user always knows what's available.

#### Post-Processing Rules
Per-field rules applied after generation:

- Tags: always include `[tag list]`, always exclude `[tag list]`, max 13
- Title: enforce max 140 chars, capitalize first word, strip special characters
- Description: enforce max 10000 chars
- Custom: regex find/replace on any field

#### Publish Rules
- Default state: Draft | Active
- Auto-publish: ON/OFF (if OFF, row enters `review` state after generation)
- Require manual approval before publishing: ON/OFF

---

### 5c. Templates Library

Reusable AI prompt templates. Categories can inherit from a base template and override specific parts.

Example hierarchy:
```
Digital Art (Base)
  ├── Watercolor Prints       (overrides tone + tag rules)
  ├── Minimalist Posters      (overrides structure + length)
  └── Abstract Art            (overrides style description focus)
```

Each template has: name, description, prompt body, default variable usage, and a preview pane showing sample output.

---

## 6. New Fields (Digital Listings table)

| Field | Type | Notes |
|---|---|---|
| Category | singleSelect | Options sourced from Listing Settings categories |
| Listing URL | text | Written after publish; links to live Etsy listing |
| Automation State | text (hidden) | Tracks current workflow step; not shown in grid |
| Processing Min Days | number | Etsy API field; default 0 for digital |
| Processing Max Days | number | Etsy API field; default 1 for digital |
| Last Generated At | dateTime | Timestamp of last successful generation run |

Fields removed from Digital Listings: **Materials**, **Production Partner IDs** (not applicable for digital).

---

## 7. Sidebar — Etsy Store Section

The sidebar gains a dedicated section for each base with `integration: "etsy"`. This sits below the generic bases section.

```
─────────────────────────
  🛍️  YIVEZ Etsy Store
     📋 Digital Listings
     📦 Physical Listings
     [+ New Listing]
─────────────────────────
```

- Clicking "Digital Listings" or "Physical Listings" opens the table view
- "+ New Listing" adds a blank row to the active listings table and focuses the Images cell — user starts by uploading an image
- The existing "New Etsy Store" button at the sidebar bottom remains for first-time store setup

---

## 8. ViewTabs Change

```
[All Listings]  [Gallery]  [By Status]  [+]  ·········  [⚙]
```

- Gear icon pinned to the right end of the tabs bar
- Clicking it opens the Listing Settings panel in the main workspace area
- Active tab state: gear icon appears "selected" when settings panel is open

---

## 9. What Doesn't Change

- Generic bases (Spaces → Bases → Tables → Records) work exactly as before
- RecordModal (expand panel) still works for reviewing and editing individual listings after generation
- Existing Etsy publish API (`POST /api/etsy/publish`) and AI generate API (`POST /api/ai/generate-listing`) are reused and extended, not replaced
- All existing views (Grid, Gallery, Kanban, Calendar) continue to work

---

## Open Questions (deferred)

- Physical listings: same system, different field configuration. Spec separately when Digital is built.
- Amazon integration: same automation architecture, different publish endpoint. Deferred.
- Scheduling: run automation at a specific time (e.g. "generate 10 listings every morning"). Deferred.
