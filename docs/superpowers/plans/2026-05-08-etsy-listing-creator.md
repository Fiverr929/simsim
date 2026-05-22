# Etsy Digital Listing Creator — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build an Airtable-style grid in the Workstation app where users can create, manage, and publish Etsy digital listings — with a full expand panel following Etsy's own section layout.

**Architecture:** A Next.js 16 app with a split-pane layout (allotment) — grid on top, listing detail panel below. Listings are persisted locally in SQLite via Prisma. Publishing hits the Etsy API v3 via Next.js route handlers that handle OAuth token refresh server-side.

**Tech Stack:** Next.js 16, React 19, TypeScript, Tailwind, shadcn/ui, @tanstack/react-table, allotment, react-hook-form, zod, sonner, Prisma + SQLite, Etsy API v3

---

## File Map

### New files to create
```
workstation/
├── .env.local                                         ← Etsy credentials
├── prisma/
│   └── schema.prisma                                  ← Listing model
├── lib/
│   ├── db.ts                                          ← Prisma client singleton
│   └── etsy/
│       ├── client.ts                                  ← Token refresh + axios instance
│       └── types.ts                                   ← Etsy API response types
├── types/
│   └── listing.ts                                     ← Shared Listing type (used everywhere)
├── app/
│   ├── api/
│   │   ├── listings/
│   │   │   ├── route.ts                               ← GET all, POST create
│   │   │   └── [id]/
│   │   │       └── route.ts                           ← PATCH update, DELETE
│   │   └── etsy/
│   │       ├── listings/
│   │       │   └── route.ts                           ← POST → createDraftListing
│   │       └── listings/[etsyId]/
│   │           ├── images/route.ts                    ← POST → uploadListingImage
│   │           ├── video/route.ts                     ← POST → uploadListingVideo
│   │           ├── files/route.ts                     ← POST → uploadListingFile
│   │           └── publish/route.ts                   ← POST → set state active
│   └── page.tsx                                       ← Workstation root page (modify)
├── components/
│   ├── workstation/
│   │   └── WorkstationLayout.tsx                      ← Top nav + platform sidebar
│   ├── grid/
│   │   ├── ListingsGrid.tsx                           ← tanstack table, allotment wrapper
│   │   └── MediaCell.tsx                              ← Thumbnail stack cell
│   └── panel/
│       ├── ListingPanel.tsx                           ← Tab wrapper + form provider
│       └── tabs/
│           ├── PhotoVideoTab.tsx                      ← Images (up to 20) + video
│           ├── CategoryTab.tsx                        ← taxonomy_id + when_made
│           ├── ItemDetailsTab.tsx                     ← title, files, description, tags
│           ├── ItemOptionsTab.tsx                     ← SKU, personalisation
│           ├── PricingTab.tsx                         ← price, quantity (locked 999)
│           ├── HowItsMadeTab.tsx                      ← locked fields + AI toggle
│           └── SettingsTab.tsx                        ← shop section, feature, renewal
```

### Files to modify
```
app/layout.tsx       ← add TooltipProvider wrapper
app/page.tsx         ← replace boilerplate with WorkstationLayout
```

---

## Task 1: Install missing dependencies

**Files:**
- Modify: `package.json` (via npm install)

- [ ] **Step 1: Install runtime dependencies**

```bash
cd "SIDE APPS/workstation"
npm install react-dropzone @dnd-kit/core @dnd-kit/sortable @dnd-kit/utilities zod sonner prisma @prisma/client
```

Expected output: `added N packages`

- [ ] **Step 2: Verify installs in package.json**

Check that these appear in `dependencies`:
- `react-dropzone`
- `@dnd-kit/core`, `@dnd-kit/sortable`, `@dnd-kit/utilities`
- `zod`
- `sonner`
- `prisma`, `@prisma/client`

- [ ] **Step 3: Add sonner component via shadcn**

```bash
npx shadcn@latest add sonner
```

Expected: `Created components/ui/sonner.tsx`

---

## Task 2: Environment + Etsy credentials

**Files:**
- Create: `.env.local`

- [ ] **Step 1: Create .env.local**

```env
ETSY_API_KEY=ohq19jf8qxx04d4jnvz6msiq
ETSY_SHARED_SECRET=b301j54sy8
ETSY_REFRESH_TOKEN=455025135.pNT84lFsReqnHtpHaZcqcMsoYFyFRsI6npBG88JUKpvduxDoLGbT6HgUHLNcXP9Zpn08pkw_JtKG_ClH0zeOHHX0D8
```

- [ ] **Step 2: Verify .env.local is gitignored**

Check `.gitignore` contains `.env.local`. If not, add it:

```
.env.local
```

---

## Task 3: Shared types

**Files:**
- Create: `types/listing.ts`

- [ ] **Step 1: Create listing types**

```typescript
// types/listing.ts

export type ListingStatus = "empty" | "draft" | "ready" | "published"

export interface ListingImage {
  id: string           // local uuid
  localUrl: string     // blob URL for preview
  file?: File          // present before upload
  rank: number         // 1 = cover
  altText: string
  etsyImageId?: number // set after Etsy upload
}

export interface ListingFile {
  id: string
  name: string
  size: number
  file?: File
  etsyFileId?: number
}

export interface Listing {
  id: string
  status: ListingStatus
  // Photo & Video
  images: ListingImage[]
  videoFile?: File
  videoLocalUrl?: string
  // Category
  taxonomyId?: number
  whenMade: string
  // Item Details
  title: string
  description: string
  digitalFiles: ListingFile[]
  tags: string[]
  isPersonalizable: boolean
  personalizationInstructions?: string
  // Item Options
  sku?: string
  // Pricing
  price?: number
  // Locked defaults (How It's Made)
  whoMade: "i_did"
  isSupply: false
  aiGenerated: boolean
  // Settings
  shopSectionId?: number
  featuredListing: boolean
  autoRenew: false
  // Etsy
  etsyListingId?: number
  createdAt: string
  updatedAt: string
}
```

---

## Task 4: Prisma + SQLite setup

**Files:**
- Create: `prisma/schema.prisma`
- Create: `lib/db.ts`

- [ ] **Step 1: Initialize Prisma**

```bash
npx prisma init --datasource-provider sqlite
```

Expected: Creates `prisma/schema.prisma` and `.env` with `DATABASE_URL`

- [ ] **Step 2: Move DATABASE_URL to .env.local**

Remove from `.env`, add to `.env.local`:

```env
DATABASE_URL="file:./dev.db"
```

- [ ] **Step 3: Write schema.prisma**

Replace contents of `prisma/schema.prisma`:

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "sqlite"
  url      = env("DATABASE_URL")
}

model Listing {
  id          String   @id @default(cuid())
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  status      String   @default("empty")
  etsyListingId Int?

  title       String   @default("")
  description String   @default("")
  price       Float?
  sku         String?

  images      String   @default("[]")   // JSON: ListingImage[]
  videoPath   String?
  digitalFiles String  @default("[]")   // JSON: ListingFile[]
  tags        String   @default("[]")   // JSON: string[]

  taxonomyId    Int?
  whenMade      String  @default("made_to_order")
  whoMade       String  @default("i_did")
  isSupply      Boolean @default(false)
  aiGenerated   Boolean @default(false)
  quantity      Int     @default(999)
  autoRenew     Boolean @default(false)

  isPersonalizable             Boolean @default(false)
  personalizationInstructions  String?
  shopSectionId                Int?
  featuredListing              Boolean @default(false)
  isTaxable                    Boolean @default(true)
}
```

- [ ] **Step 4: Generate client + push schema**

```bash
npx prisma generate
npx prisma db push
```

Expected: `✓ Generated Prisma Client` and `✓ Your database is now in sync`

- [ ] **Step 5: Create Prisma singleton**

Create `lib/db.ts`:

```typescript
import { PrismaClient } from "@prisma/client"

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient }

export const prisma =
  globalForPrisma.prisma ?? new PrismaClient()

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma
```

---

## Task 5: Local listings API routes

**Files:**
- Create: `app/api/listings/route.ts`
- Create: `app/api/listings/[id]/route.ts`

- [ ] **Step 1: Create GET + POST route**

Create `app/api/listings/route.ts`:

```typescript
import { prisma } from "@/lib/db"
import { NextResponse } from "next/server"

export async function GET() {
  const listings = await prisma.listing.findMany({
    orderBy: { createdAt: "desc" },
  })
  return NextResponse.json(listings)
}

export async function POST() {
  const listing = await prisma.listing.create({ data: {} })
  return NextResponse.json(listing, { status: 201 })
}
```

- [ ] **Step 2: Create PATCH + DELETE route**

Create `app/api/listings/[id]/route.ts`:

```typescript
import { prisma } from "@/lib/db"
import { NextRequest, NextResponse } from "next/server"

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const body = await request.json()

  // Serialize JSON fields
  const data: Record<string, unknown> = { ...body }
  if (Array.isArray(data.images)) data.images = JSON.stringify(data.images)
  if (Array.isArray(data.tags)) data.tags = JSON.stringify(data.tags)
  if (Array.isArray(data.digitalFiles)) data.digitalFiles = JSON.stringify(data.digitalFiles)

  const listing = await prisma.listing.update({ where: { id }, data })
  return NextResponse.json(listing)
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  await prisma.listing.delete({ where: { id } })
  return new NextResponse(null, { status: 204 })
}
```

- [ ] **Step 3: Start dev server and verify routes**

```bash
npm run dev
```

Test in browser:
- `POST http://localhost:3000/api/listings` → should return `{ id: "...", status: "empty", ... }`
- `GET http://localhost:3000/api/listings` → should return array

---

## Task 6: Etsy API client

**Files:**
- Create: `lib/etsy/types.ts`
- Create: `lib/etsy/client.ts`

- [ ] **Step 1: Install axios**

```bash
npm install axios
```

- [ ] **Step 2: Create Etsy types**

Create `lib/etsy/types.ts`:

```typescript
export interface EtsyTokenResponse {
  access_token: string
  token_type: string
  expires_in: number
  refresh_token: string
}

export interface EtsyDraftListingPayload {
  quantity: number
  title: string
  description: string
  price: number
  who_made: string
  when_made: string
  taxonomy_id: number
  type: "download"
  tags?: string[]
  sku?: string
  is_personalizable?: boolean
  personalization_instructions?: string
  shop_section_id?: number
  featured_rank?: number
  should_auto_renew?: boolean
  is_taxable?: boolean
}

export interface EtsyListingResponse {
  listing_id: number
  state: string
  title: string
}
```

- [ ] **Step 3: Create Etsy API client**

Create `lib/etsy/client.ts`:

```typescript
import axios from "axios"
import type { EtsyTokenResponse } from "./types"

const ETSY_BASE = "https://api.etsy.com/v3"

let cachedToken: string | null = null
let tokenExpiry = 0

async function getAccessToken(): Promise<string> {
  if (cachedToken && Date.now() < tokenExpiry) return cachedToken

  const params = new URLSearchParams({
    grant_type: "refresh_token",
    client_id: process.env.ETSY_API_KEY!,
    refresh_token: process.env.ETSY_REFRESH_TOKEN!,
  })

  const res = await axios.post<EtsyTokenResponse>(
    "https://api.etsy.com/v3/public/oauth/token",
    params.toString(),
    { headers: { "Content-Type": "application/x-www-form-urlencoded" } }
  )

  cachedToken = res.data.access_token
  tokenExpiry = Date.now() + res.data.expires_in * 1000 - 60_000
  return cachedToken
}

export async function etsyClient() {
  const token = await getAccessToken()
  return axios.create({
    baseURL: ETSY_BASE,
    headers: {
      Authorization: `Bearer ${token}`,
      "x-api-key": process.env.ETSY_API_KEY!,
    },
  })
}
```

---

## Task 7: Etsy API routes

**Files:**
- Create: `app/api/etsy/listings/route.ts`
- Create: `app/api/etsy/listings/[etsyId]/images/route.ts`
- Create: `app/api/etsy/listings/[etsyId]/video/route.ts`
- Create: `app/api/etsy/listings/[etsyId]/files/route.ts`
- Create: `app/api/etsy/listings/[etsyId]/publish/route.ts`

You need your Etsy shop ID. Run this first to get it:
```bash
# After dev server is running, call getMe via the MCP server
# OR check etsy.com — it's in your shop URL: etsy.com/shop/YOURSHOP
# Store it as ETSY_SHOP_ID in .env.local
```

Add to `.env.local`:
```env
ETSY_SHOP_ID=your_shop_id_here
```

- [ ] **Step 1: Create draft listing route**

Create `app/api/etsy/listings/route.ts`:

```typescript
import { etsyClient } from "@/lib/etsy/client"
import type { EtsyDraftListingPayload } from "@/lib/etsy/types"
import { NextRequest, NextResponse } from "next/server"
import qs from "querystring"

export async function POST(request: NextRequest) {
  const body: EtsyDraftListingPayload = await request.json()
  const shopId = process.env.ETSY_SHOP_ID!
  const client = await etsyClient()

  const payload = qs.stringify({
    ...body,
    tags: body.tags?.join(","),
  } as Record<string, unknown>)

  const res = await client.post(
    `/application/shops/${shopId}/listings`,
    payload,
    { headers: { "Content-Type": "application/x-www-form-urlencoded" } }
  )
  return NextResponse.json(res.data)
}
```

- [ ] **Step 2: Install querystring polyfill**

```bash
npm install querystring
```

- [ ] **Step 3: Create upload image route**

Create `app/api/etsy/listings/[etsyId]/images/route.ts`:

```typescript
import { etsyClient } from "@/lib/etsy/client"
import { NextRequest, NextResponse } from "next/server"

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ etsyId: string }> }
) {
  const { etsyId } = await params
  const shopId = process.env.ETSY_SHOP_ID!
  const formData = await request.formData()
  const client = await etsyClient()

  const rank = formData.get("rank") as string
  const altText = formData.get("altText") as string
  const image = formData.get("image") as File

  const outForm = new FormData()
  outForm.append("image", image)
  outForm.append("rank", rank)
  outForm.append("alt_text", altText)

  const res = await client.post(
    `/application/shops/${shopId}/listings/${etsyId}/images`,
    outForm,
    { headers: { "Content-Type": "multipart/form-data" } }
  )
  return NextResponse.json(res.data)
}
```

- [ ] **Step 4: Create upload video route**

Create `app/api/etsy/listings/[etsyId]/video/route.ts`:

```typescript
import { etsyClient } from "@/lib/etsy/client"
import { NextRequest, NextResponse } from "next/server"

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ etsyId: string }> }
) {
  const { etsyId } = await params
  const shopId = process.env.ETSY_SHOP_ID!
  const formData = await request.formData()
  const client = await etsyClient()

  const res = await client.post(
    `/application/shops/${shopId}/listings/${etsyId}/videos`,
    formData,
    { headers: { "Content-Type": "multipart/form-data" } }
  )
  return NextResponse.json(res.data)
}
```

- [ ] **Step 5: Create upload digital file route**

Create `app/api/etsy/listings/[etsyId]/files/route.ts`:

```typescript
import { etsyClient } from "@/lib/etsy/client"
import { NextRequest, NextResponse } from "next/server"

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ etsyId: string }> }
) {
  const { etsyId } = await params
  const shopId = process.env.ETSY_SHOP_ID!
  const formData = await request.formData()
  const client = await etsyClient()

  const res = await client.post(
    `/application/shops/${shopId}/listings/${etsyId}/files`,
    formData,
    { headers: { "Content-Type": "multipart/form-data" } }
  )
  return NextResponse.json(res.data)
}
```

- [ ] **Step 6: Create publish route**

Create `app/api/etsy/listings/[etsyId]/publish/route.ts`:

```typescript
import { etsyClient } from "@/lib/etsy/client"
import { NextRequest, NextResponse } from "next/server"
import qs from "querystring"

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ etsyId: string }> }
) {
  const { etsyId } = await params
  const shopId = process.env.ETSY_SHOP_ID!
  const client = await etsyClient()

  const res = await client.put(
    `/application/shops/${shopId}/listings/${etsyId}`,
    qs.stringify({ state: "active" }),
    { headers: { "Content-Type": "application/x-www-form-urlencoded" } }
  )
  return NextResponse.json(res.data)
}
```

---

## Task 8: App layout + WorkstationLayout

**Files:**
- Modify: `app/layout.tsx`
- Modify: `app/page.tsx`
- Create: `components/workstation/WorkstationLayout.tsx`

- [ ] **Step 1: Update app/layout.tsx**

```typescript
import type { Metadata } from "next"
import { Geist, Geist_Mono } from "next/font/google"
import "./globals.css"
import { TooltipProvider } from "@/components/ui/tooltip"
import { Toaster } from "@/components/ui/sonner"

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] })
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] })

export const metadata: Metadata = { title: "Workstation" }

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable} h-full`}>
      <body className="h-full flex flex-col antialiased">
        <TooltipProvider>
          {children}
          <Toaster />
        </TooltipProvider>
      </body>
    </html>
  )
}
```

- [ ] **Step 2: Create WorkstationLayout**

Create `components/workstation/WorkstationLayout.tsx`:

```typescript
"use client"

import { useState } from "react"
import { Package } from "lucide-react"

type Platform = "etsy"

interface WorkstationLayoutProps {
  children: React.ReactNode
}

export default function WorkstationLayout({ children }: WorkstationLayoutProps) {
  const [platform] = useState<Platform>("etsy")

  return (
    <div className="flex h-full w-full">
      {/* Platform sidebar */}
      <aside className="w-14 bg-neutral-900 flex flex-col items-center py-4 gap-4 shrink-0">
        <div
          className={`w-9 h-9 rounded-lg flex items-center justify-center cursor-pointer ${
            platform === "etsy" ? "bg-orange-500" : "bg-neutral-700 hover:bg-neutral-600"
          }`}
          title="Etsy"
        >
          <Package size={18} className="text-white" />
        </div>
      </aside>

      {/* Main content */}
      <div className="flex flex-col flex-1 overflow-hidden">
        {/* Top bar */}
        <header className="h-10 border-b border-neutral-200 flex items-center px-4 gap-3 shrink-0 bg-white">
          <span className="text-sm font-semibold text-neutral-700">Workstation</span>
          <span className="text-neutral-300">·</span>
          <span className="text-sm text-neutral-500 capitalize">{platform}</span>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-hidden">{children}</main>
      </div>
    </div>
  )
}
```

- [ ] **Step 3: Update app/page.tsx**

```typescript
import WorkstationLayout from "@/components/workstation/WorkstationLayout"
import ListingsGrid from "@/components/grid/ListingsGrid"

export default function Page() {
  return (
    <WorkstationLayout>
      <ListingsGrid />
    </WorkstationLayout>
  )
}
```

---

## Task 9: ListingsGrid — Airtable-style grid with allotment

**Files:**
- Create: `components/grid/MediaCell.tsx`
- Create: `components/grid/ListingsGrid.tsx`

- [ ] **Step 1: Create MediaCell**

Create `components/grid/MediaCell.tsx`:

```typescript
"use client"

import type { ListingImage } from "@/types/listing"
import { ImageIcon } from "lucide-react"

interface MediaCellProps {
  images: ListingImage[]
}

export default function MediaCell({ images }: MediaCellProps) {
  if (images.length === 0) {
    return (
      <div className="flex items-center gap-1.5 text-neutral-400">
        <ImageIcon size={14} />
        <span className="text-xs">No images</span>
      </div>
    )
  }

  return (
    <div className="flex items-center gap-1.5">
      <div className="flex -space-x-2">
        {images.slice(0, 3).map((img) => (
          <img
            key={img.id}
            src={img.localUrl}
            alt={img.altText || "listing image"}
            className="w-7 h-7 rounded object-cover border-2 border-white"
          />
        ))}
      </div>
      <span className="text-xs text-neutral-500">{images.length}/20</span>
    </div>
  )
}
```

- [ ] **Step 2: Create ListingsGrid**

Create `components/grid/ListingsGrid.tsx`:

```typescript
"use client"

import { useEffect, useState, useCallback } from "react"
import {
  useReactTable,
  getCoreRowModel,
  flexRender,
  type ColumnDef,
} from "@tanstack/react-table"
import { Allotment } from "allotment"
import "allotment/dist/style.css"
import type { Listing } from "@/types/listing"
import MediaCell from "./MediaCell"
import ListingPanel from "@/components/panel/ListingPanel"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Plus, Trash2 } from "lucide-react"
import { toast } from "sonner"

const STATUS_COLORS: Record<string, string> = {
  empty: "bg-neutral-100 text-neutral-500",
  draft: "bg-yellow-100 text-yellow-700",
  ready: "bg-blue-100 text-blue-700",
  published: "bg-green-100 text-green-700",
}

export default function ListingsGrid() {
  const [listings, setListings] = useState<Listing[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)

  const selectedListing = listings.find((l) => l.id === selectedId) ?? null

  const fetchListings = useCallback(async () => {
    const res = await fetch("/api/listings")
    const data = await res.json()
    // Parse JSON string fields from SQLite
    setListings(
      data.map((l: Listing & { images: string; tags: string; digitalFiles: string }) => ({
        ...l,
        images: typeof l.images === "string" ? JSON.parse(l.images) : l.images,
        tags: typeof l.tags === "string" ? JSON.parse(l.tags) : l.tags,
        digitalFiles: typeof l.digitalFiles === "string" ? JSON.parse(l.digitalFiles) : l.digitalFiles,
      }))
    )
  }, [])

  useEffect(() => { fetchListings() }, [fetchListings])

  const addListing = async () => {
    const res = await fetch("/api/listings", { method: "POST" })
    const listing = await res.json()
    setListings((prev) => [
      {
        ...listing,
        images: [],
        tags: [],
        digitalFiles: [],
      },
      ...prev,
    ])
    setSelectedId(listing.id)
  }

  const deleteListing = async (id: string) => {
    await fetch(`/api/listings/${id}`, { method: "DELETE" })
    setListings((prev) => prev.filter((l) => l.id !== id))
    if (selectedId === id) setSelectedId(null)
    toast.success("Listing deleted")
  }

  const updateListing = useCallback((updated: Listing) => {
    setListings((prev) => prev.map((l) => (l.id === updated.id ? updated : l)))
  }, [])

  const columns: ColumnDef<Listing>[] = [
    {
      id: "media",
      header: "Media",
      size: 140,
      cell: ({ row }) => <MediaCell images={row.original.images} />,
    },
    {
      accessorKey: "title",
      header: "Title",
      cell: ({ row }) => (
        <span className="text-sm truncate max-w-xs block">
          {row.original.title || <span className="text-neutral-400 italic">Untitled</span>}
        </span>
      ),
    },
    {
      accessorKey: "price",
      header: "Price",
      size: 90,
      cell: ({ row }) => (
        <span className="text-sm">
          {row.original.price != null ? `$${row.original.price.toFixed(2)}` : "—"}
        </span>
      ),
    },
    {
      accessorKey: "tags",
      header: "Tags",
      size: 80,
      cell: ({ row }) => (
        <span className="text-sm text-neutral-500">
          {row.original.tags.length}/13
        </span>
      ),
    },
    {
      accessorKey: "status",
      header: "Status",
      size: 100,
      cell: ({ row }) => (
        <Badge className={`text-xs capitalize ${STATUS_COLORS[row.original.status]}`}>
          {row.original.status}
        </Badge>
      ),
    },
    {
      id: "actions",
      size: 50,
      cell: ({ row }) => (
        <button
          onClick={(e) => { e.stopPropagation(); deleteListing(row.original.id) }}
          className="p-1 rounded hover:bg-red-50 text-neutral-400 hover:text-red-500 transition-colors"
        >
          <Trash2 size={14} />
        </button>
      ),
    },
  ]

  const table = useReactTable({
    data: listings,
    columns,
    getCoreRowModel: getCoreRowModel(),
  })

  return (
    <div className="h-full flex flex-col">
      {/* Toolbar */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-neutral-200 bg-white">
        <Button size="sm" onClick={addListing} className="gap-1.5">
          <Plus size={14} /> New Listing
        </Button>
        <span className="text-xs text-neutral-400">{listings.length} listings</span>
      </div>

      {/* Split pane: grid top, panel bottom */}
      <div className="flex-1 overflow-hidden">
        <Allotment vertical defaultSizes={selectedListing ? [300, 500] : [1, 0]}>
          {/* Grid */}
          <Allotment.Pane minSize={120}>
            <div className="h-full overflow-auto">
              <table className="w-full text-sm border-collapse">
                <thead className="sticky top-0 bg-neutral-50 z-10">
                  {table.getHeaderGroups().map((hg) => (
                    <tr key={hg.id} className="border-b border-neutral-200">
                      {hg.headers.map((header) => (
                        <th
                          key={header.id}
                          style={{ width: header.getSize() }}
                          className="text-left px-3 py-2 text-xs font-medium text-neutral-500 uppercase tracking-wide"
                        >
                          {flexRender(header.column.columnDef.header, header.getContext())}
                        </th>
                      ))}
                    </tr>
                  ))}
                </thead>
                <tbody>
                  {table.getRowModel().rows.map((row) => (
                    <tr
                      key={row.id}
                      onClick={() => setSelectedId(row.original.id === selectedId ? null : row.original.id)}
                      className={`border-b border-neutral-100 cursor-pointer transition-colors ${
                        row.original.id === selectedId
                          ? "bg-blue-50"
                          : "hover:bg-neutral-50"
                      }`}
                    >
                      {row.getVisibleCells().map((cell) => (
                        <td key={cell.id} className="px-3 py-2.5">
                          {flexRender(cell.column.columnDef.cell, cell.getContext())}
                        </td>
                      ))}
                    </tr>
                  ))}
                  {listings.length === 0 && (
                    <tr>
                      <td colSpan={6} className="text-center py-16 text-neutral-400 text-sm">
                        No listings yet. Click &ldquo;New Listing&rdquo; to start.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </Allotment.Pane>

          {/* Detail panel */}
          <Allotment.Pane minSize={0} visible={!!selectedListing}>
            {selectedListing && (
              <ListingPanel
                listing={selectedListing}
                onUpdate={updateListing}
                onClose={() => setSelectedId(null)}
              />
            )}
          </Allotment.Pane>
        </Allotment>
      </div>
    </div>
  )
}
```

- [ ] **Step 3: Verify grid renders**

```bash
npm run dev
```

Open `http://localhost:3000`. You should see the Workstation header, platform sidebar, "New Listing" button, and an empty grid. Clicking "New Listing" should add a row.

---

## Task 10: ListingPanel — tab wrapper

**Files:**
- Create: `components/panel/ListingPanel.tsx`

- [ ] **Step 1: Create ListingPanel**

Create `components/panel/ListingPanel.tsx`:

```typescript
"use client"

import { useState, useCallback } from "react"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import type { Listing } from "@/types/listing"
import { X } from "lucide-react"
import { toast } from "sonner"
import PhotoVideoTab from "./tabs/PhotoVideoTab"
import CategoryTab from "./tabs/CategoryTab"
import ItemDetailsTab from "./tabs/ItemDetailsTab"
import ItemOptionsTab from "./tabs/ItemOptionsTab"
import PricingTab from "./tabs/PricingTab"
import HowItsMadeTab from "./tabs/HowItsMadeTab"
import SettingsTab from "./tabs/SettingsTab"
import { Button } from "@/components/ui/button"

interface ListingPanelProps {
  listing: Listing
  onUpdate: (listing: Listing) => void
  onClose: () => void
}

export default function ListingPanel({ listing, onUpdate, onClose }: ListingPanelProps) {
  const [saving, setSaving] = useState(false)
  const [publishing, setPublishing] = useState(false)

  const save = useCallback(async (updated: Listing) => {
    setSaving(true)
    try {
      const res = await fetch(`/api/listings/${updated.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...updated,
          status: updated.status === "empty" ? "draft" : updated.status,
        }),
      })
      const saved = await res.json()
      onUpdate({ ...updated, ...saved, images: updated.images, tags: updated.tags, digitalFiles: updated.digitalFiles })
    } finally {
      setSaving(false)
    }
  }, [onUpdate])

  const publish = async () => {
    setPublishing(true)
    try {
      // Step 1: Create draft on Etsy
      const draftRes = await fetch("/api/etsy/listings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          quantity: 999,
          title: listing.title,
          description: listing.description,
          price: listing.price,
          who_made: "i_did",
          when_made: listing.whenMade,
          taxonomy_id: listing.taxonomyId,
          type: "download",
          tags: listing.tags,
          sku: listing.sku,
          is_personalizable: listing.isPersonalizable,
          personalization_instructions: listing.personalizationInstructions,
          shop_section_id: listing.shopSectionId,
          should_auto_renew: false,
        }),
      })
      const draft = await draftRes.json()
      const etsyId = draft.listing_id

      // Step 2: Upload images
      for (const img of listing.images) {
        if (!img.file) continue
        const fd = new FormData()
        fd.append("image", img.file)
        fd.append("rank", String(img.rank))
        fd.append("altText", img.altText)
        await fetch(`/api/etsy/listings/${etsyId}/images`, { method: "POST", body: fd })
      }

      // Step 3: Upload video
      if (listing.videoFile) {
        const fd = new FormData()
        fd.append("video", listing.videoFile)
        await fetch(`/api/etsy/listings/${etsyId}/video`, { method: "POST", body: fd })
      }

      // Step 4: Upload digital files
      for (const df of listing.digitalFiles) {
        if (!df.file) continue
        const fd = new FormData()
        fd.append("file", df.file)
        await fetch(`/api/etsy/listings/${etsyId}/files`, { method: "POST", body: fd })
      }

      // Step 5: Publish
      await fetch(`/api/etsy/listings/${etsyId}/publish`, { method: "POST" })

      // Update local record
      const updated: Listing = { ...listing, status: "published", etsyListingId: etsyId }
      await save(updated)
      toast.success("Listing published to Etsy!")
    } catch (err) {
      toast.error("Publish failed. Check console.")
      console.error(err)
    } finally {
      setPublishing(false)
    }
  }

  return (
    <div className="h-full flex flex-col border-t border-neutral-200 bg-white">
      {/* Panel header */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-neutral-200 shrink-0">
        <span className="text-sm font-medium text-neutral-700 truncate">
          {listing.title || "Untitled listing"}
        </span>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => save(listing)} disabled={saving}>
            {saving ? "Saving..." : "Save Draft"}
          </Button>
          <Button size="sm" onClick={publish} disabled={publishing || listing.status === "published"}>
            {publishing ? "Publishing..." : "Publish to Etsy"}
          </Button>
          <button onClick={onClose} className="p-1 rounded hover:bg-neutral-100 text-neutral-400">
            <X size={16} />
          </button>
        </div>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="photo" className="flex-1 flex flex-col overflow-hidden">
        <TabsList className="shrink-0 w-full justify-start rounded-none border-b border-neutral-200 bg-white px-4 h-9">
          {[
            { value: "photo", label: "Photo & Video" },
            { value: "category", label: "Category" },
            { value: "details", label: "Item Details" },
            { value: "options", label: "Item Options" },
            { value: "pricing", label: "Pricing & Delivery" },
            { value: "made", label: "How It's Made" },
            { value: "settings", label: "Settings" },
          ].map((t) => (
            <TabsTrigger key={t.value} value={t.value} className="text-xs h-full rounded-none data-[state=active]:border-b-2 data-[state=active]:border-blue-500">
              {t.label}
            </TabsTrigger>
          ))}
        </TabsList>

        <div className="flex-1 overflow-y-auto">
          <TabsContent value="photo" className="mt-0 p-4">
            <PhotoVideoTab listing={listing} onChange={save} />
          </TabsContent>
          <TabsContent value="category" className="mt-0 p-4">
            <CategoryTab listing={listing} onChange={save} />
          </TabsContent>
          <TabsContent value="details" className="mt-0 p-4">
            <ItemDetailsTab listing={listing} onChange={save} />
          </TabsContent>
          <TabsContent value="options" className="mt-0 p-4">
            <ItemOptionsTab listing={listing} onChange={save} />
          </TabsContent>
          <TabsContent value="pricing" className="mt-0 p-4">
            <PricingTab listing={listing} onChange={save} />
          </TabsContent>
          <TabsContent value="made" className="mt-0 p-4">
            <HowItsMadeTab listing={listing} onChange={save} />
          </TabsContent>
          <TabsContent value="settings" className="mt-0 p-4">
            <SettingsTab listing={listing} onChange={save} />
          </TabsContent>
        </div>
      </Tabs>
    </div>
  )
}
```

---

## Task 11: Tab components

**Files:**
- Create: `components/panel/tabs/PhotoVideoTab.tsx`
- Create: `components/panel/tabs/CategoryTab.tsx`
- Create: `components/panel/tabs/ItemDetailsTab.tsx`
- Create: `components/panel/tabs/ItemOptionsTab.tsx`
- Create: `components/panel/tabs/PricingTab.tsx`
- Create: `components/panel/tabs/HowItsMadeTab.tsx`
- Create: `components/panel/tabs/SettingsTab.tsx`

Each tab receives `listing: Listing` and `onChange: (listing: Listing) => void`.

- [ ] **Step 1: PhotoVideoTab — image + video manager**

Create `components/panel/tabs/PhotoVideoTab.tsx`:

```typescript
"use client"

import { useDropzone } from "react-dropzone"
import { useCallback } from "react"
import { v4 as uuid } from "uuid"
import type { Listing, ListingImage } from "@/types/listing"
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core"
import {
  SortableContext,
  useSortable,
  horizontalListSortingStrategy,
  arrayMove,
} from "@dnd-kit/sortable"
import { CSS } from "@dnd-kit/utilities"
import { X, Video, Upload } from "lucide-react"
import { Input } from "@/components/ui/input"

// Install uuid: npm install uuid @types/uuid
interface TabProps { listing: Listing; onChange: (l: Listing) => void }

function SortableImage({
  img,
  onRemove,
  onAltChange,
}: {
  img: ListingImage
  onRemove: () => void
  onAltChange: (alt: string) => void
}) {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id: img.id })
  const style = { transform: CSS.Transform.toString(transform), transition }

  return (
    <div ref={setNodeRef} style={style} className="relative group w-24 h-24 shrink-0">
      <img
        src={img.localUrl}
        alt={img.altText}
        className="w-full h-full object-cover rounded border border-neutral-200"
        {...attributes}
        {...listeners}
      />
      {img.rank === 1 && (
        <span className="absolute top-1 left-1 bg-black/60 text-white text-[10px] px-1 rounded">Cover</span>
      )}
      <button
        onClick={onRemove}
        className="absolute top-1 right-1 bg-black/60 text-white rounded-full p-0.5 hidden group-hover:flex"
      >
        <X size={10} />
      </button>
      <Input
        placeholder="Alt text"
        value={img.altText}
        onChange={(e) => onAltChange(e.target.value)}
        className="mt-1 h-6 text-[10px] px-1"
      />
    </div>
  )
}

export default function PhotoVideoTab({ listing, onChange }: TabProps) {
  const sensors = useSensors(useSensor(PointerSensor))

  const onDropImages = useCallback((files: File[]) => {
    const remaining = 20 - listing.images.length
    const toAdd = files.slice(0, remaining)
    const newImages: ListingImage[] = toAdd.map((file, i) => ({
      id: uuid(),
      file,
      localUrl: URL.createObjectURL(file),
      rank: listing.images.length + i + 1,
      altText: "",
    }))
    onChange({ ...listing, images: [...listing.images, ...newImages] })
  }, [listing, onChange])

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop: onDropImages,
    accept: { "image/jpeg": [], "image/png": [], "image/gif": [] },
    maxSize: 10 * 1024 * 1024,
    disabled: listing.images.length >= 20,
  })

  const removeImage = (id: string) => {
    const updated = listing.images
      .filter((img) => img.id !== id)
      .map((img, i) => ({ ...img, rank: i + 1 }))
    onChange({ ...listing, images: updated })
  }

  const updateAlt = (id: string, altText: string) => {
    onChange({
      ...listing,
      images: listing.images.map((img) => img.id === id ? { ...img, altText } : img),
    })
  }

  const handleDragEnd = (event: { active: { id: string }; over: { id: string } | null }) => {
    if (!event.over || event.active.id === event.over.id) return
    const oldIndex = listing.images.findIndex((i) => i.id === event.active.id)
    const newIndex = listing.images.findIndex((i) => i.id === event.over!.id)
    const reordered = arrayMove(listing.images, oldIndex, newIndex).map((img, i) => ({
      ...img,
      rank: i + 1,
    }))
    onChange({ ...listing, images: reordered })
  }

  const onDropVideo = useCallback((files: File[]) => {
    if (!files[0]) return
    onChange({
      ...listing,
      videoFile: files[0],
      videoLocalUrl: URL.createObjectURL(files[0]),
    })
  }, [listing, onChange])

  const { getRootProps: getVideoProps, getInputProps: getVideoInput } = useDropzone({
    onDrop: onDropVideo,
    accept: { "video/mp4": [], "video/quicktime": [], "video/avi": [], "video/mpeg": [] },
    maxSize: 100 * 1024 * 1024,
    maxFiles: 1,
  })

  return (
    <div className="space-y-6">
      {/* Images */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-sm font-medium">Photos <span className="text-neutral-400">({listing.images.length}/20)</span></h3>
        </div>

        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd as never}>
          <SortableContext items={listing.images.map((i) => i.id)} strategy={horizontalListSortingStrategy}>
            <div className="flex flex-wrap gap-3">
              {listing.images.map((img) => (
                <SortableImage
                  key={img.id}
                  img={img}
                  onRemove={() => removeImage(img.id)}
                  onAltChange={(alt) => updateAlt(img.id, alt)}
                />
              ))}

              {listing.images.length < 20 && (
                <div
                  {...getRootProps()}
                  className={`w-24 h-24 border-2 border-dashed rounded flex flex-col items-center justify-center cursor-pointer transition-colors shrink-0 ${
                    isDragActive ? "border-blue-400 bg-blue-50" : "border-neutral-300 hover:border-neutral-400"
                  }`}
                >
                  <input {...getInputProps()} />
                  <Upload size={18} className="text-neutral-400" />
                  <span className="text-[10px] text-neutral-400 mt-1">Add photo</span>
                </div>
              )}
            </div>
          </SortableContext>
        </DndContext>
      </div>

      {/* Video */}
      <div>
        <h3 className="text-sm font-medium mb-2">Video <span className="text-neutral-400">(1 max · 5–15s · 100MB)</span></h3>
        {listing.videoLocalUrl ? (
          <div className="relative w-40">
            <video src={listing.videoLocalUrl} className="w-40 h-24 object-cover rounded border" muted />
            <button
              onClick={() => onChange({ ...listing, videoFile: undefined, videoLocalUrl: undefined })}
              className="absolute top-1 right-1 bg-black/60 text-white rounded-full p-0.5"
            >
              <X size={10} />
            </button>
          </div>
        ) : (
          <div
            {...getVideoProps()}
            className="w-40 h-24 border-2 border-dashed border-neutral-300 rounded flex flex-col items-center justify-center cursor-pointer hover:border-neutral-400"
          >
            <input {...getVideoInput()} />
            <Video size={18} className="text-neutral-400" />
            <span className="text-[10px] text-neutral-400 mt-1">Add video</span>
          </div>
        )}
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Install uuid**

```bash
npm install uuid @types/uuid
```

- [ ] **Step 3: CategoryTab**

Create `components/panel/tabs/CategoryTab.tsx`:

```typescript
"use client"

import type { Listing } from "@/types/listing"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

interface TabProps { listing: Listing; onChange: (l: Listing) => void }

const WHEN_MADE_OPTIONS = [
  { value: "made_to_order", label: "Made to order" },
  { value: "2020_2025", label: "2020–2025" },
  { value: "2010_2019", label: "2010–2019" },
  { value: "2006_2009", label: "2006–2009" },
  { value: "before_2006", label: "Before 2006" },
  { value: "2000_2005", label: "2000–2005" },
  { value: "1990s", label: "1990s" },
  { value: "1980s", label: "1980s" },
]

export default function CategoryTab({ listing, onChange }: TabProps) {
  return (
    <div className="space-y-4 max-w-md">
      <div>
        <label className="text-xs font-medium text-neutral-600 block mb-1">
          Taxonomy ID <span className="text-red-500">*</span>
        </label>
        <Input
          type="number"
          placeholder="e.g. 2078"
          value={listing.taxonomyId ?? ""}
          onChange={(e) => onChange({ ...listing, taxonomyId: Number(e.target.value) })}
        />
        <p className="text-[11px] text-neutral-400 mt-1">
          Find your category ID at developers.etsy.com/documentation/reference#operation/getSellerTaxonomyNodes
        </p>
      </div>

      <div>
        <label className="text-xs font-medium text-neutral-600 block mb-1">When was it made?</label>
        <Select
          value={listing.whenMade}
          onValueChange={(v) => onChange({ ...listing, whenMade: v })}
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {WHEN_MADE_OPTIONS.map((o) => (
              <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="rounded-md bg-neutral-50 border border-neutral-200 p-3">
        <p className="text-xs text-neutral-500 font-medium">Locked: Digital Files</p>
        <p className="text-xs text-neutral-400 mt-0.5">Type is set to &quot;download&quot; automatically</p>
      </div>
    </div>
  )
}
```

- [ ] **Step 4: ItemDetailsTab**

Create `components/panel/tabs/ItemDetailsTab.tsx`:

```typescript
"use client"

import { useDropzone } from "react-dropzone"
import { useCallback, useState } from "react"
import { v4 as uuid } from "uuid"
import type { Listing, ListingFile } from "@/types/listing"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { X, FileIcon } from "lucide-react"
import { Badge } from "@/components/ui/badge"

interface TabProps { listing: Listing; onChange: (l: Listing) => void }

export default function ItemDetailsTab({ listing, onChange }: TabProps) {
  const [tagInput, setTagInput] = useState("")

  const onDropFiles = useCallback((files: File[]) => {
    const remaining = 5 - listing.digitalFiles.length
    const toAdd: ListingFile[] = files.slice(0, remaining).map((f) => ({
      id: uuid(),
      name: f.name,
      size: f.size,
      file: f,
    }))
    onChange({ ...listing, digitalFiles: [...listing.digitalFiles, ...toAdd] })
  }, [listing, onChange])

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop: onDropFiles,
    maxSize: 20 * 1024 * 1024,
    disabled: listing.digitalFiles.length >= 5,
  })

  const addTag = () => {
    const tag = tagInput.trim().toLowerCase()
    if (!tag || listing.tags.length >= 13 || tag.length > 20 || listing.tags.includes(tag)) return
    onChange({ ...listing, tags: [...listing.tags, tag] })
    setTagInput("")
  }

  const removeTag = (tag: string) =>
    onChange({ ...listing, tags: listing.tags.filter((t) => t !== tag) })

  return (
    <div className="space-y-5 max-w-2xl">
      {/* Title */}
      <div>
        <label className="text-xs font-medium text-neutral-600 block mb-1">
          Title <span className="text-red-500">*</span>
        </label>
        <Input
          value={listing.title}
          maxLength={140}
          onChange={(e) => onChange({ ...listing, title: e.target.value })}
          placeholder="Describe your item in a few words"
        />
        <p className="text-[11px] text-neutral-400 mt-1 text-right">{listing.title.length}/140</p>
      </div>

      {/* Digital files */}
      <div>
        <label className="text-xs font-medium text-neutral-600 block mb-1">
          Digital files <span className="text-neutral-400">({listing.digitalFiles.length}/5 · 20MB max each)</span>
        </label>
        <div
          {...getRootProps()}
          className={`border-2 border-dashed rounded p-4 text-center cursor-pointer transition-colors ${
            isDragActive ? "border-blue-400 bg-blue-50" : "border-neutral-300 hover:border-neutral-400"
          } ${listing.digitalFiles.length >= 5 ? "opacity-50 cursor-not-allowed" : ""}`}
        >
          <input {...getInputProps()} />
          <p className="text-xs text-neutral-500">Drag & drop files or click to browse</p>
        </div>
        {listing.digitalFiles.length > 0 && (
          <div className="mt-2 space-y-1">
            {listing.digitalFiles.map((f) => (
              <div key={f.id} className="flex items-center gap-2 text-xs text-neutral-600 bg-neutral-50 rounded px-2 py-1.5">
                <FileIcon size={12} />
                <span className="flex-1 truncate">{f.name}</span>
                <span className="text-neutral-400">{(f.size / 1024 / 1024).toFixed(1)}MB</span>
                <button onClick={() => onChange({ ...listing, digitalFiles: listing.digitalFiles.filter((d) => d.id !== f.id) })}>
                  <X size={12} className="text-neutral-400 hover:text-red-500" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Description */}
      <div>
        <label className="text-xs font-medium text-neutral-600 block mb-1">
          Description <span className="text-red-500">*</span>
        </label>
        <Textarea
          value={listing.description}
          onChange={(e) => onChange({ ...listing, description: e.target.value })}
          placeholder="Tell buyers about this item..."
          className="min-h-[140px] resize-y"
          maxLength={10000}
        />
        <p className="text-[11px] text-neutral-400 mt-1 text-right">{listing.description.length}/10,000</p>
      </div>

      {/* Tags */}
      <div>
        <label className="text-xs font-medium text-neutral-600 block mb-1">
          Tags <span className="text-neutral-400">({listing.tags.length}/13 · 20 chars max each)</span>
        </label>
        <div className="flex gap-2">
          <Input
            value={tagInput}
            onChange={(e) => setTagInput(e.target.value.slice(0, 20))}
            onKeyDown={(e) => e.key === "Enter" && addTag()}
            placeholder="Add a tag and press Enter"
          />
          <button
            onClick={addTag}
            disabled={listing.tags.length >= 13}
            className="px-3 py-1.5 text-xs bg-neutral-900 text-white rounded disabled:opacity-40"
          >
            Add
          </button>
        </div>
        {listing.tags.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mt-2">
            {listing.tags.map((tag) => (
              <Badge key={tag} variant="secondary" className="gap-1 text-xs">
                {tag}
                <button onClick={() => removeTag(tag)}><X size={10} /></button>
              </Badge>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
```

- [ ] **Step 5: ItemOptionsTab**

Create `components/panel/tabs/ItemOptionsTab.tsx`:

```typescript
"use client"

import type { Listing } from "@/types/listing"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"

interface TabProps { listing: Listing; onChange: (l: Listing) => void }

export default function ItemOptionsTab({ listing, onChange }: TabProps) {
  return (
    <div className="space-y-4 max-w-md">
      <div className="rounded-md bg-neutral-50 border border-neutral-200 p-3">
        <p className="text-xs text-neutral-500 font-medium">Variations</p>
        <p className="text-xs text-neutral-400 mt-0.5">Variations are unavailable for digital listings.</p>
      </div>

      <div>
        <label className="text-xs font-medium text-neutral-600 block mb-1">SKU</label>
        <Input
          value={listing.sku ?? ""}
          onChange={(e) => onChange({ ...listing, sku: e.target.value })}
          placeholder="Optional stock-keeping unit"
        />
      </div>

      <div>
        <div className="flex items-center justify-between mb-1">
          <label className="text-xs font-medium text-neutral-600">Personalisation</label>
          <button
            onClick={() => onChange({ ...listing, isPersonalizable: !listing.isPersonalizable })}
            className={`text-xs px-2 py-0.5 rounded-full border transition-colors ${
              listing.isPersonalizable
                ? "bg-blue-500 text-white border-blue-500"
                : "border-neutral-300 text-neutral-500"
            }`}
          >
            {listing.isPersonalizable ? "On" : "Off"}
          </button>
        </div>
        {listing.isPersonalizable && (
          <Textarea
            value={listing.personalizationInstructions ?? ""}
            onChange={(e) => onChange({ ...listing, personalizationInstructions: e.target.value })}
            placeholder="Instructions for buyers (e.g. Please provide name and colour)"
            className="min-h-[80px]"
          />
        )}
      </div>
    </div>
  )
}
```

- [ ] **Step 6: PricingTab**

Create `components/panel/tabs/PricingTab.tsx`:

```typescript
"use client"

import type { Listing } from "@/types/listing"
import { Input } from "@/components/ui/input"

interface TabProps { listing: Listing; onChange: (l: Listing) => void }

export default function PricingTab({ listing, onChange }: TabProps) {
  return (
    <div className="space-y-4 max-w-md">
      <div>
        <label className="text-xs font-medium text-neutral-600 block mb-1">
          Price (USD) <span className="text-red-500">*</span>
        </label>
        <div className="relative">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400 text-sm">$</span>
          <Input
            type="number"
            min={0.01}
            step={0.01}
            value={listing.price ?? ""}
            onChange={(e) => onChange({ ...listing, price: parseFloat(e.target.value) })}
            className="pl-7"
            placeholder="0.00"
          />
        </div>
      </div>

      <div>
        <label className="text-xs font-medium text-neutral-600 block mb-1">Quantity</label>
        <Input value="999 (unlimited — digital)" disabled className="bg-neutral-50 text-neutral-400" />
      </div>

      <div className="rounded-md bg-neutral-50 border border-neutral-200 p-3">
        <p className="text-xs text-neutral-500 font-medium">Delivery</p>
        <p className="text-xs text-neutral-400 mt-0.5">
          Buyers download your files immediately after purchase. No shipping required.
        </p>
      </div>
    </div>
  )
}
```

- [ ] **Step 7: HowItsMadeTab**

Create `components/panel/tabs/HowItsMadeTab.tsx`:

```typescript
"use client"

import type { Listing } from "@/types/listing"

interface TabProps { listing: Listing; onChange: (l: Listing) => void }

export default function HowItsMadeTab({ listing, onChange }: TabProps) {
  return (
    <div className="space-y-4 max-w-md">
      {/* Locked fields */}
      <div className="rounded-md bg-neutral-50 border border-neutral-200 p-3 space-y-2">
        <div>
          <p className="text-xs font-medium text-neutral-500">Who made it?</p>
          <p className="text-xs text-neutral-700 mt-0.5">I did — a member of my shop</p>
        </div>
        <div>
          <p className="text-xs font-medium text-neutral-500">What is it?</p>
          <p className="text-xs text-neutral-700 mt-0.5">A finished product</p>
        </div>
      </div>

      {/* AI toggle */}
      <div>
        <p className="text-xs font-medium text-neutral-600 mb-2">How is this digital content created?</p>
        <div className="flex flex-col gap-2">
          {[
            { value: false, label: "Created by me", desc: "I made this item myself or with my shop members" },
            { value: true, label: "With an AI generator", desc: "AI tools were used to create or assist in creating this item" },
          ].map((opt) => (
            <label key={String(opt.value)} className="flex items-start gap-3 cursor-pointer">
              <input
                type="radio"
                checked={listing.aiGenerated === opt.value}
                onChange={() => onChange({ ...listing, aiGenerated: opt.value })}
                className="mt-0.5"
              />
              <div>
                <p className="text-xs font-medium text-neutral-700">{opt.label}</p>
                <p className="text-xs text-neutral-400">{opt.desc}</p>
              </div>
            </label>
          ))}
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 8: SettingsTab**

Create `components/panel/tabs/SettingsTab.tsx`:

```typescript
"use client"

import type { Listing } from "@/types/listing"
import { Input } from "@/components/ui/input"

interface TabProps { listing: Listing; onChange: (l: Listing) => void }

export default function SettingsTab({ listing, onChange }: TabProps) {
  return (
    <div className="space-y-4 max-w-md">
      <div>
        <label className="text-xs font-medium text-neutral-600 block mb-1">Shop Section ID</label>
        <Input
          type="number"
          value={listing.shopSectionId ?? ""}
          onChange={(e) => onChange({ ...listing, shopSectionId: Number(e.target.value) || undefined })}
          placeholder="Optional — organise into a shop section"
        />
      </div>

      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs font-medium text-neutral-600">Feature this listing</p>
          <p className="text-[11px] text-neutral-400">Show in your shop&apos;s featured section</p>
        </div>
        <button
          onClick={() => onChange({ ...listing, featuredListing: !listing.featuredListing })}
          className={`text-xs px-2 py-0.5 rounded-full border transition-colors ${
            listing.featuredListing
              ? "bg-blue-500 text-white border-blue-500"
              : "border-neutral-300 text-neutral-500"
          }`}
        >
          {listing.featuredListing ? "On" : "Off"}
        </button>
      </div>

      <div className="rounded-md bg-neutral-50 border border-neutral-200 p-3">
        <p className="text-xs font-medium text-neutral-500">Renewal option</p>
        <p className="text-xs text-neutral-700 mt-0.5">Manual — requires manual renewal after expiry</p>
      </div>
    </div>
  )
}
```

---

## Task 12: Final verification

- [ ] **Step 1: Run dev server**

```bash
npm run dev
```

- [ ] **Step 2: Verify full flow**

Check all of these work:
1. Open `http://localhost:3000` — Workstation layout renders
2. Click "New Listing" — row appears in grid
3. Click the row — panel opens below
4. Navigate all 7 tabs — each renders without errors
5. Add images in Photo & Video — thumbnails appear, drag to reorder, add alt text
6. Fill title, description, tags in Item Details — character counters update
7. Set price in Pricing tab
8. Click "Save Draft" — toast appears, status changes to "draft"
9. Refresh page — listing persists (SQLite)
10. Click "Publish to Etsy" — goes through all 5 API steps (requires valid Etsy shop ID in .env.local)

- [ ] **Step 3: TypeScript check**

```bash
npx tsc --noEmit
```

Expected: no errors

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "feat: Workstation — Etsy digital listing creator with grid + panel UI"
```

---

## Self-Review

**Spec coverage:**
- ✅ Airtable-style grid (unlimited rows) — @tanstack/react-table
- ✅ Click row → expand panel — allotment split pane
- ✅ Etsy's 7-section layout (Photo & Video → Settings)
- ✅ Up to 20 images with drag-to-reorder + alt text per image
- ✅ 1 video slot
- ✅ Up to 5 digital files (20MB each)
- ✅ Tags (13 max, 20 chars each) with counter
- ✅ Title (140 char limit)
- ✅ Description (10k char limit)
- ✅ Locked defaults: who_made=i_did, quantity=999, autoRenew=false
- ✅ AI toggle in How It's Made
- ✅ Prisma + SQLite persistence
- ✅ 5-step Etsy publish flow
- ✅ Save as Draft + Publish buttons

**Known gaps to address later:**
- Taxonomy ID picker (currently a number input — needs a proper searchable dropdown using the Etsy taxonomy API)
- Shop section picker (same — needs API call to fetch shop sections)
- Publish error handling per-step (currently one catch for all steps)
- Image upload progress indicator
