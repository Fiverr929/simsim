# Etsy AI Automation — Design Spec

**Date:** 2026-05-21
**Status:** Approved

## Goal

Add two automation actions to the Workstation app's RecordModal when viewing an Etsy listing table:

1. **Generate with AI** — send attached images to Claude, receive title + description + tags, write them back to the record fields
2. **Publish to Etsy** — push the record's field data to the Etsy API v3, upload media, activate the listing

---

## Context

The app is an Airtable-like platform (Space → Base → Table → Records). An "Etsy Store" base is seeded via `POST /api/seed/etsy`. The seed creates a Listings table with Etsy-specific fields. Records in this table represent Etsy listings.

The automations live inside the existing **RecordModal** — no new layout or navigation needed.

---

## Table Schema

The seed route is updated to create **two tables** in the Etsy Store base:

### Digital Listings

| Field | Type | Notes |
|---|---|---|
| Title | text | 140 chars, primary |
| Description | longText | 10,000 chars |
| Type | singleSelect | locked to "digital" |
| Price | number | USD, currency format |
| Quantity | number | locked to 999 |
| Status | singleSelect | empty / draft / ready / published |
| Tags | multiSelect | 13 max, 20 chars each |
| Styles | multiSelect | 2 max |
| Materials | multiSelect | |
| Images | attachment | up to 10, cover = rank 1 |
| Video | attachment | 1 max, mp4/mov, 5–15s, 100MB |
| Digital Files | attachment | up to 5, 20MB each |
| SKU | text | |
| Taxonomy ID | number | Etsy category ID |
| When Made | singleSelect | made_to_order / 2020_2025 / 2010_2019 / 2006_2009 / before_2006 |
| Who Made | singleSelect | i_did / collective / someone_else |
| Is Supply | checkbox | |
| AI Generated | checkbox | Etsy disclosure requirement |
| Is Personalizable | checkbox | |
| Personalisation Required | checkbox | |
| Personalisation Max Chars | number | |
| Personalisation Instructions | longText | |
| Featured | checkbox | |
| Shop Section ID | number | |
| Return Policy ID | number | |
| Is Taxable | checkbox | default true |
| Auto Renew | checkbox | default false |
| Production Partner IDs | text | comma-separated |
| Etsy Listing ID | number | written after publish |

### Physical Listings

Same fields as Digital Listings, except:
- No **Digital Files** field
- Add **Shipping Profile ID** (number) — required, references an Etsy shipping profile

---

## Architecture

### New API Routes

#### `POST /api/ai/generate-listing`

**Request:** `{ recordId: string }`

**Flow:**
1. Fetch record from DB, resolve its table's fields
2. Find the Images field, read attached file paths from record data
3. Load image files from disk (`public/uploads/`), encode to base64
4. Call Claude API (`claude-sonnet-4-6`) with vision — pass images + prompt
5. Parse response: `{ title: string, description: string, tags: string[] }`
6. Find the Title, Description, Tags field IDs on the table
7. PATCH the record's data with generated values — Tags is a multiSelect field, so each tag is written as a select option value (create new options in the field config if they don't already exist)
8. Return `{ title, description, tags }`

**Claude prompt intent:** Given product images, write an Etsy-optimised title (max 140 chars), a compelling description (3–5 paragraphs, SEO keywords woven in), and exactly 13 relevant tags (max 20 chars each, lowercase).

**Error handling:** Return 400 if no images attached. Return 500 with message on Claude API failure.

#### `POST /api/etsy/publish`

**Request:** `{ recordId: string }`

**Flow:**
1. Fetch record + table fields from DB
2. Map record data to Etsy API payload (field name → API param)
3. Call Etsy `createDraftListing` → get `listing_id`
4. Upload each image file: `POST /application/shops/:shopId/listings/:id/images`
5. Upload video if present: `POST /application/shops/:shopId/listings/:id/videos`
6. If table name is "Digital Listings": upload each digital file: `POST /application/shops/:shopId/listings/:id/files`
7. Activate: `PUT /application/shops/:shopId/listings/:id` with `{ state: "active" }`
8. Write `etsyListingId` and `status = "published"` back to the record
9. Return `{ etsyListingId }`

**Error handling:** Each step wrapped individually — if image/video/file upload fails, log and continue (don't abort the publish). If draft creation fails, return 500 immediately.

### Etsy Client

`lib/etsy/client.ts` — token refresh + cached axios instance:
- Uses `ETSY_API_KEY` + `ETSY_REFRESH_TOKEN` env vars
- Refreshes access token when expired (cached in module scope)
- Returns configured axios instance with `Authorization` + `x-api-key` headers

`lib/etsy/types.ts` — TypeScript types for Etsy request/response payloads.

### RecordModal Changes

**Detection:** When RecordModal opens, check if the current table has a field named `"Etsy Listing ID"`. If yes, show the Etsy automation bar.

**Automation bar** (shown above the field list):
- **"Generate with AI"** button — disabled if no images attached, shows spinner during generation, updates fields in place on success
- **"Publish to Etsy"** button — disabled if Status is already "published", shows spinner during publish, updates Etsy Listing ID + Status on success
- Both buttons show a toast on success/failure via `sonner`

---

## Environment Variables

```env
ANTHROPIC_API_KEY=...
ETSY_API_KEY=...
ETSY_REFRESH_TOKEN=...
ETSY_SHOP_ID=...
```

---

## File Map

### New files
```
lib/etsy/client.ts
lib/etsy/types.ts
app/api/ai/generate-listing/route.ts
app/api/etsy/publish/route.ts
```

### Modified files
```
app/api/seed/etsy/route.ts     ← two tables, complete field set
components/table/RecordModal.tsx  ← Etsy automation bar
```

---

## Out of Scope (this version)

- Fetching Etsy reference data (shipping profiles, shop sections, taxonomy) — users enter IDs manually
- Smart field visibility based on listing type
- Readiness score / validation before publish
- Batch generation across multiple records
- Importing existing Etsy listings
