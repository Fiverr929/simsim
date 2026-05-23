# Workstation

A flexible, Airtable-style database workstation with a built-in Etsy listing creator and AI automation engine. Create spaces, build databases, and automate product listing generation using Google Gemini.

---

## Features

- **Multi-view database** — Grid, Gallery, and Kanban views with sorting, filtering, and field hiding
- **Flexible field types** — Text, number, date, select, multi-select, checkbox, URL, image attachments, and more
- **Etsy integration** — Seed a pre-configured Etsy store base with the right fields out of the box
- **Listing Settings panel** — Per-store configuration: categories, field roles, AI prompt templates, post-process rules, and store defaults
- **AI automation engine** — Select rows and click Run; Gemini analyzes product images and generates Title, Description, and Tags automatically
- **Live cell updates** — Field values appear in the grid as each row finishes generating
- **Run / Stop / Retry** — Full automation lifecycle with per-row error handling and progress tracking
- **CSV import / export** — Auto-detects delimiter and encoding; creates missing fields automatically
- **Drag-and-drop** — Reorder fields, views, and description blocks

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | Next.js 16 (App Router) |
| UI | React 19, Tailwind CSS v4, shadcn/ui, lucide-react |
| Grid | Glide Data Grid |
| Database | SQLite via Prisma + libSQL |
| AI | Google Gemini 2.5 Flash |
| Forms | React Hook Form + Zod |
| DnD | dnd-kit |

---

## Getting Started

### Prerequisites

- Node.js 18+
- A [Google AI Studio](https://aistudio.google.com/) API key (`GOOGLE_API_KEY`)
- (Optional) Etsy API credentials for live publishing

### Installation

```bash
git clone https://github.com/Fiverr929/simsim.git
cd simsim
npm install
```

### Environment Setup

Copy the example env file and fill in your keys:

```bash
cp .env.example .env.local
```

Edit `.env.local`:

```env
DATABASE_URL="file:./dev.db"
GOOGLE_API_KEY=your_google_api_key_here

# Optional — only needed for live Etsy publishing
ETSY_API_KEY=your_etsy_api_key
ETSY_SHARED_SECRET=your_etsy_shared_secret
ETSY_REFRESH_TOKEN=your_etsy_refresh_token
ETSY_SHOP_ID=your_etsy_shop_id
```

### Database Setup

```bash
npx prisma migrate dev
```

### Run

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

---

## Project Structure

```
app/
  api/                  # API routes (REST)
    automation/         # run-row — AI pipeline per record
    bases/              # Base CRUD
    fields/             # Field CRUD + batch
    listing-settings/   # Per-base Etsy settings + category sync
    records/            # Record CRUD + reorder
    seed/etsy/          # Seed a pre-built Etsy store base
    spaces/             # Space CRUD
    tables/             # Table CRUD
    upload/             # File upload to /public
    views/              # View CRUD
components/
  app/                  # Shell: sidebar, view tabs, app context
  listing-settings/     # Settings panel: categories, templates, field roles
  table/                # Grid, gallery, kanban, toolbar, automation toolbar
  ui/                   # Shared UI primitives
hooks/
  useRecords.ts         # Record state + patchLocalRecord
  useTable.ts           # Table + field state
types/
  core.ts               # AppRecord, Field, View, CellValue, etc.
  listing-settings.ts   # ListingSettings, ListingCategory, PostProcessRule, etc.
prisma/
  schema.prisma         # Space → Base → Table → Field / Record / View
```

---

## Automation Engine

The automation engine runs client-side and calls `POST /api/automation/run-row` per row.

### Pipeline (per row)

1. Load record + base `ListingSettings`
2. Resolve category from the Category field (option ID = `ListingCategory.id`)
3. Read product images from `/public` as base64
4. Build dynamic prompt (from category `templateOverride` + description blocks, or default prompt)
5. Call Gemini 2.5 Flash with images + prompt
6. Apply post-process rules (append/exclude tags, max chars, capitalize, regex replace)
7. Resolve/create multiSelect options for Tags
8. Apply default-role field values and store-level defaults
9. Write results to DB, set Automation State → `review` (or `published` if autoPublish)
10. Return `fieldUpdates` to client for live cell update

### Automation States

| State | Meaning |
|-------|---------|
| `idle` | Not yet run |
| `queued` | Waiting in current batch |
| `generating` | API call in progress |
| `review` | Generated, awaiting review |
| `published` | Published to Etsy |
| `error` | Generation failed — use Retry |

---

## Listing Settings

Access via the gear icon (Etsy tables only). Three sections:

- **Store Defaults** — global auto-run toggle, batch size, per-field defaults
- **Categories** — per-category config with 5 tabs:
  - Identity (name, icon, color, price, publish rules)
  - Trigger (when to auto-run)
  - Fields (role assignment: trigger / context / generated / default / manual / hidden)
  - AI Template (prompt override + description block editor)
  - Post-Process (tag append/exclude, string transforms)
- **Templates Library** — reusable prompt templates shared across categories

---

## Database Schema

```
Space
└── Base  (config JSON — stores ListingSettings)
    └── Table
        ├── Field   (type + config JSON — options, formats, etc.)
        ├── Record  (data JSON — keyed by Field.id)
        └── View    (type + config JSON — sorts, filters, hidden fields)
```

---

## Development

```bash
npm run dev        # Start dev server (http://localhost:3000)
npm run build      # Production build
npm run lint       # ESLint
npx prisma studio  # Browse the database visually
```

---

## License

Private — all rights reserved.
