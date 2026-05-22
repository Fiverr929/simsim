# Architecture Redesign — Data Layer (Plan 1 of 2)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the hardcoded Etsy listing schema with a flexible Space → Base → Table → Field → Record system, expose full CRUD API for each layer, and seed an Etsy Listings template.

**Architecture:** All dynamic field values are stored as a JSON string in `Record.data` keyed by field ID — no EAV, no per-field columns. Field definitions live in a `Field` table with a `type` and JSON `config` column. Views store their filter/sort/visibility config as JSON. Old `Workstation` and `Listing` models are dropped and replaced.

**Tech Stack:** Next.js 16 App Router, Prisma 7 + libsql adapter, SQLite, TypeScript.

---

## File Map

**Delete:**
- `app/api/workstations/route.ts`
- `app/api/workstations/[id]/route.ts`
- `app/api/listings/route.ts`
- `app/api/listings/[id]/route.ts`
- `app/api/etsy/` (whole directory)
- `types/listing.ts`
- `lib/etsy/` (whole directory)

**Modify:**
- `prisma/schema.prisma` — replace Workstation + Listing with Space, Base, Table, Field, Record, View
- `lib/db.ts` — no change needed, same Prisma setup

**Create:**
- `types/core.ts` — all shared TypeScript types
- `app/api/spaces/route.ts` — GET, POST
- `app/api/spaces/[id]/route.ts` — PATCH, DELETE
- `app/api/bases/route.ts` — GET (by spaceId), POST
- `app/api/bases/[id]/route.ts` — PATCH, DELETE
- `app/api/tables/route.ts` — GET (by baseId), POST
- `app/api/tables/[id]/route.ts` — GET (with fields+views), PATCH, DELETE
- `app/api/fields/route.ts` — POST
- `app/api/fields/[id]/route.ts` — PATCH, DELETE
- `app/api/records/route.ts` — GET (by tableId), POST
- `app/api/records/[id]/route.ts` — PATCH, DELETE
- `app/api/views/route.ts` — POST
- `app/api/views/[id]/route.ts` — PATCH, DELETE
- `app/api/seed/etsy/route.ts` — POST, creates a full Etsy Listings base with fields + default view

---

## Task 1: New Prisma Schema

**Files:**
- Modify: `prisma/schema.prisma`

- [ ] **Step 1: Replace schema**

Replace the entire content of `prisma/schema.prisma` with:

```prisma
generator client {
  provider = "prisma-client"
  output   = "../lib/generated/prisma"
}

datasource db {
  provider = "sqlite"
}

model Space {
  id        String   @id @default(cuid())
  createdAt DateTime @default(now())
  name      String   @default("My Space")
  icon      String   @default("🏠")
  bases     Base[]
}

model Base {
  id        String   @id @default(cuid())
  createdAt DateTime @default(now())
  name      String
  icon      String   @default("📊")
  spaceId   String
  space     Space    @relation(fields: [spaceId], references: [id], onDelete: Cascade)
  tables    Table[]
}

model Table {
  id        String   @id @default(cuid())
  createdAt DateTime @default(now())
  name      String
  order     Int      @default(0)
  baseId    String
  base      Base     @relation(fields: [baseId], references: [id], onDelete: Cascade)
  fields    Field[]
  records   Record[]
  views     View[]
}

model Field {
  id        String   @id @default(cuid())
  createdAt DateTime @default(now())
  name      String
  type      String
  config    String   @default("{}")
  order     Int      @default(0)
  isPrimary Boolean  @default(false)
  tableId   String
  table     Table    @relation(fields: [tableId], references: [id], onDelete: Cascade)
}

model Record {
  id        String   @id @default(cuid())
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
  order     Float    @default(0)
  data      String   @default("{}")
  tableId   String
  table     Table    @relation(fields: [tableId], references: [id], onDelete: Cascade)
}

model View {
  id        String   @id @default(cuid())
  createdAt DateTime @default(now())
  name      String
  type      String
  config    String   @default("{}")
  order     Int      @default(0)
  tableId   String
  table     Table    @relation(fields: [tableId], references: [id], onDelete: Cascade)
}
```

- [ ] **Step 2: Run migration**

```bash
cd "C:\Users\This PC\Gravity\SIDE APPS\workstation"
npx prisma migrate dev --name architecture-redesign
```

Expected output: `✔ Generated Prisma Client` and migration applied.

- [ ] **Step 3: Regenerate client**

```bash
npx prisma generate
```

Expected: `✔ Generated Prisma Client (7.x.x) to .\lib\generated\prisma`

---

## Task 2: Core TypeScript Types

**Files:**
- Create: `types/core.ts`
- Delete: `types/listing.ts` (after this task)

- [ ] **Step 1: Create `types/core.ts`**

```typescript
export type FieldType =
  | "text"
  | "longText"
  | "number"
  | "singleSelect"
  | "multiSelect"
  | "date"
  | "checkbox"
  | "attachment"
  | "url"

export interface SelectOption {
  id: string
  label: string
  color: string
}

export interface FieldConfig {
  options?: SelectOption[]
  dateFormat?: string
  numberFormat?: "integer" | "decimal" | "currency" | "percent"
  currency?: string
}

export interface Field {
  id: string
  name: string
  type: FieldType
  config: FieldConfig
  order: number
  isPrimary: boolean
  tableId: string
}

export type CellValue = string | number | boolean | string[] | null

export interface AppRecord {
  id: string
  createdAt: string
  updatedAt: string
  order: number
  data: Record<string, CellValue>
  tableId: string
}

export type ViewType = "grid" | "gallery" | "kanban" | "calendar" | "form"

export type FilterOperator =
  | "is"
  | "isNot"
  | "contains"
  | "doesNotContain"
  | "isEmpty"
  | "isNotEmpty"
  | "gt"
  | "lt"

export interface Filter {
  fieldId: string
  operator: FilterOperator
  value: CellValue
}

export interface Sort {
  fieldId: string
  direction: "asc" | "desc"
}

export interface ViewConfig {
  hiddenFields?: string[]
  filters?: Filter[]
  sorts?: Sort[]
  groupFieldId?: string
  coverFieldId?: string
  dateFieldId?: string
  colorFieldId?: string
  rowHeight?: number
}

export interface View {
  id: string
  name: string
  type: ViewType
  config: ViewConfig
  order: number
  tableId: string
}

export interface AppTable {
  id: string
  name: string
  order: number
  baseId: string
  fields: Field[]
  views: View[]
}

export interface Base {
  id: string
  name: string
  icon: string
  spaceId: string
  tables: AppTable[]
}

export interface Space {
  id: string
  name: string
  icon: string
  createdAt: string
}
```

- [ ] **Step 2: Delete old listing type file**

Delete `types/listing.ts`.

---

## Task 3: Spaces API

**Files:**
- Create: `app/api/spaces/route.ts`
- Create: `app/api/spaces/[id]/route.ts`

- [ ] **Step 1: Create `app/api/spaces/route.ts`**

```typescript
import { NextResponse } from "next/server"
import { prisma } from "@/lib/db"

export async function GET() {
  const spaces = await prisma.space.findMany({ orderBy: { createdAt: "asc" } })
  return NextResponse.json(spaces)
}

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}))
  const space = await prisma.space.create({
    data: { name: body.name ?? "New Space", icon: body.icon ?? "🏠" },
  })
  return NextResponse.json(space, { status: 201 })
}
```

- [ ] **Step 2: Create `app/api/spaces/[id]/route.ts`**

```typescript
import { NextResponse } from "next/server"
import { prisma } from "@/lib/db"

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const body = await req.json()
  const space = await prisma.space.update({ where: { id }, data: { name: body.name, icon: body.icon } })
  return NextResponse.json(space)
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  await prisma.space.delete({ where: { id } })
  return new NextResponse(null, { status: 204 })
}
```

- [ ] **Step 3: Verify**

```bash
curl -s -X POST http://localhost:3000/api/spaces \
  -H "Content-Type: application/json" \
  -d '{"name":"Test Space"}' | python -m json.tool
```

Expected: JSON with `id`, `name: "Test Space"`, `icon: "🏠"`.

---

## Task 4: Bases API

**Files:**
- Create: `app/api/bases/route.ts`
- Create: `app/api/bases/[id]/route.ts`

- [ ] **Step 1: Create `app/api/bases/route.ts`**

```typescript
import { NextResponse } from "next/server"
import { prisma } from "@/lib/db"

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const spaceId = searchParams.get("spaceId")
  if (!spaceId) return NextResponse.json({ error: "spaceId required" }, { status: 400 })
  const bases = await prisma.base.findMany({
    where: { spaceId },
    orderBy: { createdAt: "asc" },
    include: { tables: { orderBy: { order: "asc" }, select: { id: true, name: true, order: true, baseId: true } } },
  })
  return NextResponse.json(bases)
}

export async function POST(req: Request) {
  const body = await req.json()
  const base = await prisma.base.create({
    data: { name: body.name ?? "New Base", icon: body.icon ?? "📊", spaceId: body.spaceId },
    include: { tables: true },
  })
  return NextResponse.json(base, { status: 201 })
}
```

- [ ] **Step 2: Create `app/api/bases/[id]/route.ts`**

```typescript
import { NextResponse } from "next/server"
import { prisma } from "@/lib/db"

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const body = await req.json()
  const data: Record<string, string> = {}
  if (body.name !== undefined) data.name = body.name
  if (body.icon !== undefined) data.icon = body.icon
  const base = await prisma.base.update({ where: { id }, data })
  return NextResponse.json(base)
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  await prisma.base.delete({ where: { id } })
  return new NextResponse(null, { status: 204 })
}
```

---

## Task 5: Tables API

**Files:**
- Create: `app/api/tables/route.ts`
- Create: `app/api/tables/[id]/route.ts`

- [ ] **Step 1: Create `app/api/tables/route.ts`**

```typescript
import { NextResponse } from "next/server"
import { prisma } from "@/lib/db"

export async function POST(req: Request) {
  const body = await req.json()
  const count = await prisma.table.count({ where: { baseId: body.baseId } })
  const table = await prisma.table.create({
    data: { name: body.name ?? "Table", order: count, baseId: body.baseId },
  })
  // Create a default "Name" primary text field and a default Grid view
  await prisma.field.create({
    data: { name: "Name", type: "text", isPrimary: true, order: 0, tableId: table.id },
  })
  await prisma.view.create({
    data: { name: "Grid", type: "grid", order: 0, tableId: table.id },
  })
  const full = await prisma.table.findUnique({
    where: { id: table.id },
    include: { fields: { orderBy: { order: "asc" } }, views: { orderBy: { order: "asc" } } },
  })
  return NextResponse.json(full, { status: 201 })
}
```

- [ ] **Step 2: Create `app/api/tables/[id]/route.ts`**

```typescript
import { NextResponse } from "next/server"
import { prisma } from "@/lib/db"

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const table = await prisma.table.findUnique({
    where: { id },
    include: {
      fields: { orderBy: { order: "asc" } },
      views: { orderBy: { order: "asc" } },
    },
  })
  if (!table) return NextResponse.json({ error: "Not found" }, { status: 404 })
  return NextResponse.json({
    ...table,
    fields: table.fields.map((f) => ({ ...f, config: JSON.parse(f.config) })),
    views: table.views.map((v) => ({ ...v, config: JSON.parse(v.config) })),
  })
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const body = await req.json()
  const table = await prisma.table.update({ where: { id }, data: { name: body.name } })
  return NextResponse.json(table)
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  await prisma.table.delete({ where: { id } })
  return new NextResponse(null, { status: 204 })
}
```

---

## Task 6: Fields API

**Files:**
- Create: `app/api/fields/route.ts`
- Create: `app/api/fields/[id]/route.ts`

- [ ] **Step 1: Create `app/api/fields/route.ts`**

```typescript
import { NextResponse } from "next/server"
import { prisma } from "@/lib/db"

export async function POST(req: Request) {
  const body = await req.json()
  const count = await prisma.field.count({ where: { tableId: body.tableId } })
  const field = await prisma.field.create({
    data: {
      name: body.name ?? "Field",
      type: body.type ?? "text",
      config: JSON.stringify(body.config ?? {}),
      order: count,
      tableId: body.tableId,
    },
  })
  return NextResponse.json({ ...field, config: JSON.parse(field.config) }, { status: 201 })
}
```

- [ ] **Step 2: Create `app/api/fields/[id]/route.ts`**

```typescript
import { NextResponse } from "next/server"
import { prisma } from "@/lib/db"

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const body = await req.json()
  const data: Record<string, unknown> = {}
  if (body.name !== undefined) data.name = body.name
  if (body.type !== undefined) data.type = body.type
  if (body.config !== undefined) data.config = JSON.stringify(body.config)
  if (body.order !== undefined) data.order = body.order
  const field = await prisma.field.update({ where: { id }, data })
  return NextResponse.json({ ...field, config: JSON.parse(field.config) })
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  await prisma.field.delete({ where: { id } })
  return new NextResponse(null, { status: 204 })
}
```

---

## Task 7: Records API

**Files:**
- Create: `app/api/records/route.ts`
- Create: `app/api/records/[id]/route.ts`

- [ ] **Step 1: Create `app/api/records/route.ts`**

```typescript
import { NextResponse } from "next/server"
import { prisma } from "@/lib/db"

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const tableId = searchParams.get("tableId")
  if (!tableId) return NextResponse.json({ error: "tableId required" }, { status: 400 })
  const records = await prisma.record.findMany({
    where: { tableId },
    orderBy: { order: "asc" },
  })
  return NextResponse.json(records.map((r) => ({ ...r, data: JSON.parse(r.data) })))
}

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}))
  const { searchParams } = new URL(req.url)
  const tableId = body.tableId ?? searchParams.get("tableId")
  if (!tableId) return NextResponse.json({ error: "tableId required" }, { status: 400 })
  const count = await prisma.record.count({ where: { tableId } })
  const record = await prisma.record.create({
    data: {
      tableId,
      order: count,
      data: JSON.stringify(body.data ?? {}),
    },
  })
  return NextResponse.json({ ...record, data: JSON.parse(record.data) }, { status: 201 })
}
```

- [ ] **Step 2: Create `app/api/records/[id]/route.ts`**

```typescript
import { NextResponse } from "next/server"
import { prisma } from "@/lib/db"

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const body = await req.json()
  const existing = await prisma.record.findUnique({ where: { id } })
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 })
  const existingData = JSON.parse(existing.data) as Record<string, unknown>
  const merged = { ...existingData, ...(body.data ?? {}) }
  const record = await prisma.record.update({
    where: { id },
    data: { data: JSON.stringify(merged) },
  })
  return NextResponse.json({ ...record, data: JSON.parse(record.data) })
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  await prisma.record.delete({ where: { id } })
  return new NextResponse(null, { status: 204 })
}
```

---

## Task 8: Views API

**Files:**
- Create: `app/api/views/route.ts`
- Create: `app/api/views/[id]/route.ts`

- [ ] **Step 1: Create `app/api/views/route.ts`**

```typescript
import { NextResponse } from "next/server"
import { prisma } from "@/lib/db"

export async function POST(req: Request) {
  const body = await req.json()
  const count = await prisma.view.count({ where: { tableId: body.tableId } })
  const view = await prisma.view.create({
    data: {
      name: body.name ?? "View",
      type: body.type ?? "grid",
      config: JSON.stringify(body.config ?? {}),
      order: count,
      tableId: body.tableId,
    },
  })
  return NextResponse.json({ ...view, config: JSON.parse(view.config) }, { status: 201 })
}
```

- [ ] **Step 2: Create `app/api/views/[id]/route.ts`**

```typescript
import { NextResponse } from "next/server"
import { prisma } from "@/lib/db"

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const body = await req.json()
  const data: Record<string, unknown> = {}
  if (body.name !== undefined) data.name = body.name
  if (body.type !== undefined) data.type = body.type
  if (body.config !== undefined) data.config = JSON.stringify(body.config)
  const view = await prisma.view.update({ where: { id }, data })
  return NextResponse.json({ ...view, config: JSON.parse(view.config) })
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  await prisma.view.delete({ where: { id } })
  return new NextResponse(null, { status: 204 })
}
```

---

## Task 9: Etsy Template Seeder

**Files:**
- Create: `app/api/seed/etsy/route.ts`

- [ ] **Step 1: Create `app/api/seed/etsy/route.ts`**

This creates a complete "Etsy Store" base inside a given space with all Etsy listing fields and a default Grid view.

```typescript
import { NextResponse } from "next/server"
import { prisma } from "@/lib/db"

const ETSY_FIELDS = [
  { name: "Title", type: "text", isPrimary: true, config: {} },
  { name: "Description", type: "longText", config: {} },
  { name: "Price", type: "number", config: { numberFormat: "currency", currency: "USD" } },
  { name: "Status", type: "singleSelect", config: {
    options: [
      { id: "empty", label: "Empty", color: "#a3a3a3" },
      { id: "draft", label: "Draft", color: "#eab308" },
      { id: "ready", label: "Ready", color: "#22c55e" },
      { id: "published", label: "Published", color: "#3b82f6" },
    ],
  }},
  { name: "Tags", type: "multiSelect", config: {} },
  { name: "Images", type: "attachment", config: {} },
  { name: "SKU", type: "text", config: {} },
  { name: "When Made", type: "singleSelect", config: {
    options: [
      { id: "made_to_order", label: "Made to order", color: "#a3a3a3" },
      { id: "2020_2024", label: "2020-2024", color: "#a3a3a3" },
      { id: "2010_2019", label: "2010-2019", color: "#a3a3a3" },
    ],
  }},
  { name: "AI Generated", type: "checkbox", config: {} },
  { name: "Featured", type: "checkbox", config: {} },
  { name: "Quantity", type: "number", config: { numberFormat: "integer" } },
  { name: "Shop Section ID", type: "number", config: { numberFormat: "integer" } },
  { name: "Etsy Listing ID", type: "number", config: { numberFormat: "integer" } },
] as const

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}))
  const spaceId = body.spaceId

  if (!spaceId) return NextResponse.json({ error: "spaceId required" }, { status: 400 })

  // Create base
  const base = await prisma.base.create({
    data: { name: "Etsy Store", icon: "🛍️", spaceId },
  })

  // Create Listings table
  const table = await prisma.table.create({
    data: { name: "Listings", order: 0, baseId: base.id },
  })

  // Create fields
  await Promise.all(
    ETSY_FIELDS.map((f, i) =>
      prisma.field.create({
        data: {
          name: f.name,
          type: f.type,
          config: JSON.stringify(f.config),
          order: i,
          isPrimary: "isPrimary" in f ? f.isPrimary : false,
          tableId: table.id,
        },
      })
    )
  )

  // Create default views
  await prisma.view.createMany({
    data: [
      { name: "All Listings", type: "grid", order: 0, tableId: table.id },
      { name: "Gallery", type: "gallery", order: 1, tableId: table.id },
      { name: "By Status", type: "kanban", order: 2, tableId: table.id },
    ],
  })

  const full = await prisma.table.findUnique({
    where: { id: table.id },
    include: { fields: { orderBy: { order: "asc" } }, views: { orderBy: { order: "asc" } } },
  })

  return NextResponse.json({ base, table: full }, { status: 201 })
}
```

- [ ] **Step 2: Verify seeder**

Start the dev server, then run:

```bash
# First create a space
SPACE=$(curl -s -X POST http://localhost:3000/api/spaces \
  -H "Content-Type: application/json" \
  -d '{"name":"My Space"}')
echo $SPACE

# Extract id and seed Etsy template
SPACE_ID=$(echo $SPACE | python -c "import sys,json; print(json.load(sys.stdin)['id'])")
curl -s -X POST http://localhost:3000/api/seed/etsy \
  -H "Content-Type: application/json" \
  -d "{\"spaceId\":\"$SPACE_ID\"}" | python -m json.tool
```

Expected: JSON showing the base, table with 13 fields and 3 views.

---

## Task 10: Cleanup Old Files

**Files:**
- Delete all old API routes and types

- [ ] **Step 1: Delete old files**

Delete these files/directories:
- `app/api/workstations/route.ts`
- `app/api/workstations/[id]/route.ts`
- `app/api/listings/route.ts`
- `app/api/listings/[id]/route.ts`
- `app/api/etsy/` (entire directory)
- `lib/etsy/` (entire directory)

- [ ] **Step 2: Remove broken imports**

Any file still importing from `@/types/listing` or `@/lib/etsy` will break. Search for these imports:

```bash
grep -r "types/listing\|lib/etsy" "C:\Users\This PC\Gravity\SIDE APPS\workstation" --include="*.ts" --include="*.tsx"
```

For each file found, remove or comment out the import (the UI rebuild in Plan 2 will fix these properly).

- [ ] **Step 3: Verify server starts clean**

```bash
npm run dev
```

Expected: Server starts on port 3000 with no module errors. API routes `/api/spaces`, `/api/bases`, `/api/tables`, `/api/fields`, `/api/records`, `/api/views`, `/api/seed/etsy` all respond.
