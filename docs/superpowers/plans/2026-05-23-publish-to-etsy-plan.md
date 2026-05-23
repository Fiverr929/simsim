# Publish to Etsy — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Wire the existing `/api/etsy/publish` endpoint to the AutomationToolbar so users can select `review` rows and publish them to Etsy in one click, with live grid updates on success.

**Architecture:** Client-side publish loop mirrors the existing `runAutomation` pattern — `publishListings` in `TableView` iterates over selected review records, calls `POST /api/etsy/publish` per row, and applies returned `fieldUpdates` via `patchLocalRecord`. The toolbar gains a green Publish button that shows/hides based on running/publishing state, sharing the existing `abortRef` for stop.

**Tech Stack:** Next.js App Router (TypeScript), React 19, Tailwind CSS v4, Prisma/SQLite, existing Etsy client lib.

---

## File Map

| File | Change |
|------|--------|
| `app/api/etsy/publish/route.ts` | Add `Listing URL` + `Automation State = published` to `fieldUpdates` before DB write and JSON response |
| `components/table/AutomationToolbar.tsx` | Add `onPublish`, `publishing`, `publishProgress` props + Publish button + publishing progress display |
| `components/table/TableView.tsx` | Add `publishRunning`/`publishProgress` state, `publishListings` callback, reset effect additions, pass new props |

---

### Task 1: Extend the API — write Listing URL and Automation State back to the record

**Files:**
- Modify: `app/api/etsy/publish/route.ts:174-186`

- [ ] **Step 1: Add the two new field writes**

Find section starting at line 174 (the comment `// 6. Write Etsy Listing ID + status=published back to record`) and replace the `fieldUpdates` block + DB update + return with:

```typescript
    // 6. Write Etsy Listing ID, Listing URL, Automation State, and status=published back to record
    const etsyIdField = fieldByName["Etsy Listing ID"]
    const statusField = fieldByName["Status"]
    const listingUrlField = fieldByName["Listing URL"]
    const automationStateField = fieldByName["Automation State"]

    const fieldUpdates: Record<string, CellValue> = {}
    if (etsyIdField) fieldUpdates[etsyIdField.id] = listingId
    if (statusField) fieldUpdates[statusField.id] = "published"
    if (listingUrlField) fieldUpdates[listingUrlField.id] = `https://www.etsy.com/listing/${listingId}`
    if (automationStateField) {
      const stateConfig = JSON.parse(automationStateField.config ?? "{}") as {
        options?: Array<{ id: string; label: string }>
      }
      const publishedOption = stateConfig.options?.find((o) => o.label === "published")
      if (publishedOption) fieldUpdates[automationStateField.id] = publishedOption.id
    }

    const merged = { ...data, ...fieldUpdates }
    await prisma.record.update({
      where: { id: recordId },
      data: { data: JSON.stringify(merged) },
    })

    return NextResponse.json({ etsyListingId: listingId, fieldUpdates })
```

- [ ] **Step 2: Verify the file compiles**

```bash
npx tsc --noEmit
```

Expected: no errors in `app/api/etsy/publish/route.ts`.

- [ ] **Step 3: Commit**

```bash
git add app/api/etsy/publish/route.ts
git commit -m "feat(etsy): write Listing URL and Automation State back on publish"
```

---

### Task 2: Update AutomationToolbar — add Publish button and publishing state

**Files:**
- Modify: `components/table/AutomationToolbar.tsx`

- [ ] **Step 1: Replace the full file content**

```tsx
"use client"

import { Play, Square, RotateCcw, Loader2, Upload } from "lucide-react"
import { cn } from "@/lib/utils"
import type { AppRecord, Field } from "@/types/core"

interface Props {
  records: AppRecord[]
  fields: Field[]
  selectedRecordIds: string[]
  running: boolean
  progress: { done: number; total: number } | null
  onRun: (recordIds: string[]) => void
  onStop: () => void
  onRetry: () => void
  onPublish: (recordIds: string[]) => void
  publishing: boolean
  publishProgress: { done: number; total: number } | null
}

export function AutomationToolbar({
  records, fields, selectedRecordIds,
  running, progress, onRun, onStop, onRetry,
  onPublish, publishing, publishProgress,
}: Props) {
  const automationStateField = fields.find((f) => f.name === "Automation State")

  const pendingIds = automationStateField
    ? records
        .filter((r) => {
          const state = r.data[automationStateField.id]
          return state == null || state === "idle"
        })
        .map((r) => r.id)
    : []

  const errorIds = automationStateField
    ? records.filter((r) => r.data[automationStateField.id] === "error").map((r) => r.id)
    : []

  const reviewIds = automationStateField
    ? records
        .filter((r) => {
          const stateConfig = (() => {
            try { return JSON.parse(automationStateField.config ?? "{}") as { options?: Array<{ id: string; label: string }> } }
            catch { return {} }
          })()
          const reviewOption = stateConfig.options?.find((o) => o.label === "review")
          return reviewOption && r.data[automationStateField.id] === reviewOption.id
        })
        .map((r) => r.id)
    : []

  const selectedReviewIds = selectedRecordIds.filter((id) => reviewIds.includes(id))
  const publishTarget = selectedReviewIds.length > 0 ? selectedReviewIds : reviewIds

  const hasSelected = selectedRecordIds.length > 0
  const runTarget = hasSelected ? selectedRecordIds : pendingIds

  return (
    <div className="flex items-center gap-2 px-3 py-1 bg-orange-50 border-b border-orange-100 shrink-0">
      <span className="text-[10px] font-semibold uppercase tracking-wider text-orange-400 mr-1 select-none">
        Automation
      </span>

      {publishing ? (
        <>
          <div className="flex items-center gap-1.5 text-xs text-green-600 select-none">
            <Loader2 size={12} className="animate-spin shrink-0" />
            {publishProgress
              ? `Publishing ${publishProgress.done} / ${publishProgress.total}…`
              : "Publishing…"}
          </div>
          <button
            onClick={onStop}
            className="ml-1 flex items-center gap-1 px-2.5 py-0.5 text-xs text-red-600 bg-white hover:bg-red-50 rounded border border-red-200 transition-colors"
          >
            <Square size={11} /> Stop
          </button>
        </>
      ) : running ? (
        <>
          <div className="flex items-center gap-1.5 text-xs text-orange-600 select-none">
            <Loader2 size={12} className="animate-spin shrink-0" />
            {progress ? `Generating ${progress.done} / ${progress.total}…` : "Running…"}
          </div>
          <button
            onClick={onStop}
            className="ml-1 flex items-center gap-1 px-2.5 py-0.5 text-xs text-red-600 bg-white hover:bg-red-50 rounded border border-red-200 transition-colors"
          >
            <Square size={11} /> Stop
          </button>
        </>
      ) : (
        <>
          <button
            onClick={() => onRun(runTarget)}
            disabled={runTarget.length === 0}
            className={cn(
              "flex items-center gap-1 px-2.5 py-0.5 text-xs rounded border transition-colors",
              runTarget.length > 0
                ? "text-orange-600 bg-white hover:bg-orange-50 border-orange-200"
                : "text-neutral-300 bg-white border-neutral-200 cursor-not-allowed"
            )}
          >
            <Play size={11} />
            {hasSelected
              ? `Run selected (${selectedRecordIds.length})`
              : pendingIds.length > 0
              ? `Run pending (${pendingIds.length})`
              : "No pending rows"}
          </button>

          {publishTarget.length > 0 && (
            <button
              onClick={() => onPublish(publishTarget)}
              className="flex items-center gap-1 px-2.5 py-0.5 text-xs text-green-600 bg-white hover:bg-green-50 rounded border border-green-200 transition-colors"
            >
              <Upload size={11} /> Publish ({publishTarget.length})
            </button>
          )}

          {errorIds.length > 0 && (
            <button
              onClick={onRetry}
              className="flex items-center gap-1 px-2.5 py-0.5 text-xs text-red-600 bg-white hover:bg-red-50 rounded border border-red-200 transition-colors"
            >
              <RotateCcw size={11} /> Retry errors ({errorIds.length})
            </button>
          )}
        </>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Verify the file compiles**

```bash
npx tsc --noEmit
```

Expected: no type errors in `components/table/AutomationToolbar.tsx`.

- [ ] **Step 3: Commit**

```bash
git add components/table/AutomationToolbar.tsx
git commit -m "feat(toolbar): add Publish button with publishing progress state"
```

---

### Task 3: Update TableView — add publishListings loop and wire props

**Files:**
- Modify: `components/table/TableView.tsx`

- [ ] **Step 1: Add publishRunning and publishProgress state**

After line 114 (`const runningRef = useRef(false)`), add:

```typescript
  const [publishRunning, setPublishRunning] = useState(false)
  const [publishProgress, setPublishProgress] = useState<{ done: number; total: number } | null>(null)
```

- [ ] **Step 2: Add publishRunning/publishProgress to the reset effect**

The `useEffect` at line 124 currently resets `selectedRecordIds`, `automationRunning`, `automationProgress`, and `abortRef`. Add the two new state resets:

```typescript
  useEffect(() => {
    setSelectedRecordIds([])
    setAutomationRunning(false)
    setAutomationProgress(null)
    setPublishRunning(false)
    setPublishProgress(null)
    abortRef.current = false
  }, [activeTableId])
```

- [ ] **Step 3: Add the publishListings callback**

After the `retryErrors` callback (line 286), add:

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

- [ ] **Step 4: Pass the new props to AutomationToolbar**

In the JSX at line 547, the existing `<AutomationToolbar>` block is:

```tsx
              <AutomationToolbar
                records={displayRecords}
                fields={fields}
                selectedRecordIds={selectedRecordIds}
                running={automationRunning}
                progress={automationProgress}
                onRun={runAutomation}
                onStop={() => { abortRef.current = true }}
                onRetry={retryErrors}
              />
```

Replace it with:

```tsx
              <AutomationToolbar
                records={displayRecords}
                fields={fields}
                selectedRecordIds={selectedRecordIds}
                running={automationRunning}
                progress={automationProgress}
                onRun={runAutomation}
                onStop={() => { abortRef.current = true }}
                onRetry={retryErrors}
                onPublish={publishListings}
                publishing={publishRunning}
                publishProgress={publishProgress}
              />
```

- [ ] **Step 5: Verify the full project compiles**

```bash
npx tsc --noEmit
```

Expected: no errors across all three modified files.

- [ ] **Step 6: Commit**

```bash
git add components/table/TableView.tsx
git commit -m "feat(table): add publishListings loop and wire Publish button"
```
