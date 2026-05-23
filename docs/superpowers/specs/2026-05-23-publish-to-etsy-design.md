# Publish to Etsy — Design Spec

**Date:** 2026-05-23

---

## Goal

Wire up the existing `POST /api/etsy/publish` endpoint to the AutomationToolbar so users can select rows in `review` state and publish them to Etsy in one click. On success, `Automation State`, `Listing URL`, and `Etsy Listing ID` are written back to the record and reflected live in the grid.

---

## Architecture

Client-side orchestration matching the existing Run loop pattern. The user selects rows → clicks Publish in the toolbar → `TableView` loops through selected review rows calling `/api/etsy/publish` per row → results applied to local state via `patchLocalRecord`.

Three touch points:
1. **API** — `app/api/etsy/publish/route.ts` — add `Automation State = published` and `Listing URL` to field updates
2. **AutomationToolbar** — add Publish button + publish progress state
3. **TableView** — add `publishListings` loop with separate running/progress state

---

## API Changes — `app/api/etsy/publish/route.ts`

Currently the route writes `Etsy Listing ID` and `Status = published` back to the record. Add two more writes before the DB update:

**`Listing URL`** — constructed from the returned listing ID:
```
https://www.etsy.com/listing/{listingId}
```

**`Automation State`** — set to `"published"` (the option ID matching the seed).

Both are added to `fieldUpdates` and included in the JSON response so the client can apply them via `patchLocalRecord`.

---

## AutomationToolbar Changes — `components/table/AutomationToolbar.tsx`

### New Props

```typescript
onPublish: (recordIds: string[]) => void
publishing: boolean
publishProgress: { done: number; total: number } | null
```

### Behaviour

**Idle state (not running, not publishing):**
- Derive `reviewIds` from records where `Automation State === "review"`
- Derive `publishTarget`: selected rows that are in `review` state if any selected, else all `reviewIds`
- Show **"Publish (N)"** button when `publishTarget.length > 0`
- Button is disabled when `running === true`

**Publishing state:**
- Show spinner + `"Publishing X / Y…"` text
- Show **Stop** button (calls `onStop` — shares the same abort mechanism as Run)
- Hide Run button while publishing

**Running state:**
- Hide Publish button while `running === true`

### Button styling
Matches the existing Run button style but uses green: `text-green-600 border-green-200 hover:bg-green-50`.

---

## TableView Changes — `components/table/TableView.tsx`

### New State

```typescript
const [publishRunning, setPublishRunning] = useState(false)
const [publishProgress, setPublishProgress] = useState<{ done: number; total: number } | null>(null)
```

`publishRunning` also uses the shared `runningRef` to prevent double-start (same ref used by `runAutomation`).

### New Callback — `publishListings`

```typescript
const publishListings = useCallback(async (recordIds: string[]) => {
  if (!activeBaseId || runningRef.current) return

  setPublishRunning(true)
  runningRef.current = true
  abortRef.current = false
  setPublishProgress({ done: 0, total: recordIds.length })

  const automationStateField = fields.find((f) => f.name === "Automation State")

  let done = 0
  for (const recordId of recordIds) {
    if (abortRef.current) break

    try {
      const res = await fetch("/api/etsy/publish", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ recordId }),
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
    setPublishProgress({ done, total: recordIds.length })
  }

  setPublishRunning(false)
  runningRef.current = false
  setPublishProgress(null)
}, [activeBaseId, fields, patchLocalRecord, updateRecord])
```

### Reset on Table Change

Add `publishRunning`, `publishProgress` to the existing `useEffect` that resets automation state on `activeTableId` change.

### AutomationToolbar JSX

Pass the new props to `<AutomationToolbar>`:
```tsx
<AutomationToolbar
  ...existing props...
  onPublish={publishListings}
  publishing={publishRunning}
  publishProgress={publishProgress}
/>
```

---

## Data Flow

```
User selects review rows → clicks "Publish (N)"
  → publishListings(recordIds) starts
  → for each recordId:
      POST /api/etsy/publish { recordId }
        → creates Etsy listing
        → uploads images / files
        → activates listing
        → writes Etsy Listing ID, Listing URL, Automation State, Status to DB
        → returns { etsyListingId, fieldUpdates }
      patchLocalRecord(recordId, fieldUpdates)  ← live UI update
  → done: publishRunning = false
```

---

## Error Handling

- Per-row publish failure: set `Automation State = error` via both `patchLocalRecord` and `updateRecord` (same pattern as `runAutomation`)
- Abort mid-run: `abortRef.current = true` stops after the current row completes
- No retry button for publish failures — user can fix the row and re-select for a second publish attempt

---

## Files Changed

| File | Change |
|------|--------|
| `app/api/etsy/publish/route.ts` | Add `Listing URL` + `Automation State = published` to field updates |
| `components/table/AutomationToolbar.tsx` | Add `onPublish`, `publishing`, `publishProgress` props + Publish button |
| `components/table/TableView.tsx` | Add `publishListings` callback, `publishRunning`/`publishProgress` state, reset effect, pass props |
