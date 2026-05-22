# Commerce Workspace — Architecture Document

**Date:** 2026-05-21  
**Status:** In Progress (brainstorming phase)  
**App location:** `C:\Users\This PC\Gravity\SIDE APPS\workstation`

---

## What This App Is

A Next.js 16 + React 19 + SQLite workspace app — think lightweight Airtable — being extended into a **commerce operations platform** for a seller who operates on both Etsy and Amazon (YIVEZ brand, Amazon India, seller ID AIZDLMZQLYDDV).

The seller makes AI-generated images using CafeHTML (their own tool, `C:\Users\This PC\Gravity\CafeHTML`) and sells them as digital products on Etsy, plus physical products on Amazon.

---

## Current App Architecture (as built)

### Data Model (SQLite via Prisma)

```
Space
  └── Base (has config: { integration?: "etsy" | string })
        └── Table
              ├── Field (type, config JSON)
              ├── Record (data JSON)
              └── View (grid | gallery | kanban | calendar | form)
```

### Stack

- **Framework:** Next.js 16.2.6 (Turbopack, App Router)
- **UI:** React 19, Tailwind CSS v4, shadcn/ui, lucide-react
- **DB:** SQLite via Prisma 7.8, `lib/generated/prisma` client
- **State:** React hooks + context (`AppContext` for active space/base/table/view)
- **File uploads:** Stored in `public/uploads/`, referenced as `/uploads/<uuid>.<ext>`
- **Notifications:** sonner (toast)

### Key Files

```
app/
  layout.tsx                    — Root layout with Toaster + AppProvider
  page.tsx                      → AppShell
  api/
    spaces/                     — GET all, POST create
    bases/                      — GET by spaceId, POST create, PATCH, DELETE
      [id]/                     — config field added to Base model (2026-05-21)
    tables/                     — GET, POST, PATCH, DELETE
    fields/                     — GET, POST, PATCH, DELETE, batch
    records/                    — GET by tableId, POST, PATCH, DELETE, batch, reorder
    views/                      — PATCH, DELETE
    upload/                     — POST → saves to public/uploads/, returns /uploads/<file>
    seed/
      etsy/                     — POST → creates Etsy Store base with 2 tables
    ai/
      generate-listing/         — POST { recordId } → calls Google Gemini, writes Title/Desc/Tags
    etsy/
      publish/                  — POST { recordId } → creates draft, uploads media, activates

components/
  app/
    AppShell.tsx                — Main layout: TopNav + BaseSidebar + TableView
    AppContext.tsx              — activeSpaceId, activeBaseId, activeTableId, activeViewId,
                                   activeBaseIntegration, setters, openTable()
    BaseSidebar.tsx             — Space/base/table tree; sets activeBaseIntegration on table click
    TopNav.tsx
    ViewTabs.tsx
  table/
    TableView.tsx               — Main table view, passes integration prop to RecordModal
    RecordModal.tsx             — Expand panel for a record; shows Etsy automation bar
                                   when integration === "etsy"
    DynamicGrid.tsx             — Glide Data Grid
    DynamicGallery.tsx
    DynamicKanban.tsx
    DynamicCalendar.tsx
    DynamicForm.tsx
    Toolbar.tsx
    AddFieldModal.tsx
    FieldHeaderMenu.tsx
    fields/                     — Field type renderers
    records/                    — Record list components
  layout/
    ExpandPanel.tsx             — Right-side slide-in panel
  ui/                           — shadcn components

lib/
  db.ts                        — Prisma singleton
  api.ts                       — apiError(), handleApiError()
  utils.ts                     — cn(), formatDate()
  field-types.tsx              — Field type definitions + icons
  etsy/
    client.ts                  — Token refresh + cached axios instance
    types.ts                   — EtsyCreateListingPayload, EtsyListing

prisma/
  schema.prisma                — Space, Base (+ config), Table, Field, Record, View

types/
  core.ts                      — Field, FieldConfig, BaseConfig, Base, AppRecord,
                                   AppTable, View, Space, CellValue, etc.
```

---

## Etsy Integration (as built)

### How it's detected

`Base.config` (JSON string in DB, parsed to `BaseConfig`) carries `integration: "etsy"`.  
Set automatically when seeding via `POST /api/seed/etsy`.  
`BaseSidebar` sets `activeBaseIntegration` in context when user clicks a table.  
`TableView` passes `integration` prop to `RecordModal`.  
`RecordModal` shows the Etsy automation bar when `integration === "etsy"`.

### Etsy tables (created by seed)

**Digital Listings** (29 fields including Digital Files):  
Title, Description, Type, Price, Quantity, Status, Tags, Styles, Materials, Images, Video, Digital Files, SKU, Taxonomy ID, When Made, Who Made, Is Supply, AI Generated, Is Personalizable, Personalisation Required, Personalisation Max Chars, Personalisation Instructions, Featured, Shop Section ID, Return Policy ID, Is Taxable, Auto Renew, Production Partner IDs, Etsy Listing ID

**Physical Listings** (same minus Digital Files, plus Shipping Profile ID)

### Automation bar (in RecordModal)

- **Generate with AI** button (purple):  
  Disabled if no images attached.  
  Calls `POST /api/ai/generate-listing` → sends images to Google Gemini 2.5 Flash via `aiplatform.googleapis.com` REST API (same pattern as CafeHTML).  
  Returns `{ title, description, tags, fieldUpdates, updatedFields }`.  
  Updates local `data` + `localFields` state in modal; calls `onUpdate` to sync parent.

- **Publish to Etsy** button (orange):  
  Disabled if Status === "published".  
  Calls `POST /api/etsy/publish` → maps record fields to Etsy API v3, creates draft, uploads images/video/digital files, activates listing.  
  Writes Etsy Listing ID + Status=published back to record.

### Environment variables (in .env.local)

```
GOOGLE_API_KEY=               ← user to fill in (same key as CafeHTML)
ETSY_API_KEY=ohq19jf8qxx04d4jnvz6msiq
ETSY_SHARED_SECRET=b301j54sy8
ETSY_REFRESH_TOKEN=455025135.pNT84...
ETSY_SHOP_ID=28137671
DATABASE_URL=file:./dev.db
```

---

## What the User Rejected

- **Seed route as the entry point** — too hidden, not a real feature
- **Field-name sniffing** to detect Etsy tables (`fields.some(f => f.name === "Etsy Listing ID")`) — replaced with `Base.config.integration`
- Standalone Etsy listing tool (old May 8 plan) — superseded by the generic workspace approach

---

## Commerce Workspace Vision (in design)

The user wants to evolve the generic workspace into a **commerce operations platform**. Key modules planned:

| Module | Description |
|---|---|
| **Listing Creator** | Create Etsy/Amazon listings (digital or physical) via a proper UI flow — not a seed route |
| **Orders** | Import + track orders from Etsy and Amazon |
| **Customers** | CRM — buyer details, order history, contact info |
| **Marketing** | Campaign notes, promotions, bulk tasks |
| **Bulk Edit** | Multi-record editing across listings |

### Platforms in scope
- **Etsy** — digital and physical listings, orders
- **Amazon** — listings (YIVEZ brand, Amazon India), orders

### Open design questions (brainstorming in progress)
1. **Workspace structure:** Dedicated "Commerce" sidebar section vs. smart base templates?
2. **Listing Creator flow:** Modal/wizard where user picks platform + type (digital/physical)?
3. **Module priority:** Which to build first?

### Key constraint
The generic workspace (Spaces → Bases → Tables → Records) must remain functional for non-commerce use. Commerce features layer on top, not replace.

---

## Dev Server

Running on `http://localhost:3000` (Next.js dev, Turbopack).  
Visual companion brainstorming server on `http://localhost:58972`.

---

## Related Projects

- **CafeHTML** (`C:\Users\This PC\Gravity\CafeHTML`) — AI image generation tool the user uses to create product images. Uses Google Gemini via `aiplatform.googleapis.com` REST API with an API key stored in settings UI. This is the pattern used for the Generate with AI feature.
- **YIVEZ Amazon Store** — Amazon India, seller ID AIZDLMZQLYDDV, marketplace A21TJRUUN4KGV

---

## Next Steps (pending design approval)

1. Finalize workspace structure (Commerce section vs. templates)
2. Design the Listing Creator flow
3. Spec the Orders module
4. Write implementation plan
