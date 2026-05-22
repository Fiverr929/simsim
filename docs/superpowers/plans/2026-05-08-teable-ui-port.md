# Teable UI Port Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the current tanstack-table + Allotment grid with a glide-data-grid canvas grid, a resizable left sidebar (adapted from Teable), and a right-side expand panel (adapted from Teable) — giving the app an Airtable-quality feel.

**Architecture:** The layout becomes: resizable left `AppSidebar` | main content area with `DataEditor` filling it | `ExpandPanel` absolutely positioned over the right side of the grid when a row is selected. The Allotment split pane is removed entirely. `ListingsGrid` manages all state and renders both the grid and the expand panel.

**Tech Stack:** `@glideapps/glide-data-grid` (canvas grid), `re-resizable` (sidebar resize), `react-hotkeys-hook` (Mod+B toggle), adapted Teable Panel.tsx + Sidebar.tsx patterns.

---

## File Map

| File | Action | Purpose |
|------|--------|---------|
| `components/layout/AppSidebar.tsx` | CREATE | Resizable, collapsible left sidebar (adapted from Teable Sidebar.tsx) |
| `components/layout/ExpandPanel.tsx` | CREATE | Draggable right-side expand panel (adapted from Teable Panel.tsx) |
| `components/grid/ListingsGrid.tsx` | REWRITE | glide-data-grid canvas grid + ExpandPanel + ListingPanel wired together |
| `components/workstation/WorkstationLayout.tsx` | REWRITE | Use AppSidebar, remove old narrow sidebar |
| `components/grid/MediaCell.tsx` | DELETE | No longer needed |
| `app/globals.css` | MODIFY | Add 4 CSS variables Panel needs |

---

### Task 1: Install dependencies

**Files:**
- Modify: `package.json` (via npm install)

- [ ] **Step 1: Install the four packages**

Run:
```
cd "C:\Users\This PC\Gravity\SIDE APPS\workstation" && npm install @glideapps/glide-data-grid re-resizable react-hotkeys-hook react-use
```

Expected: packages added, no peer-dep errors.

- [ ] **Step 2: Verify TypeScript can see them**

Run:
```
cd "C:\Users\This PC\Gravity\SIDE APPS\workstation" && npx tsc --noEmit 2>&1 | head -5
```

Expected: same errors as before (none introduced by installs).

---

### Task 2: Add CSS variables

**Files:**
- Modify: `app/globals.css`

These four variables are required by `ExpandPanel`'s sash styling.

- [ ] **Step 1: Add variables to `:root` block in `app/globals.css`**

Find the `:root {` block (around line 51) and add inside it:

```css
  --sash-size: 8px;
  --sash-hover-size: 3px;
  --separator-border: hsl(var(--border));
  --focus-border: hsl(var(--primary));
```

- [ ] **Step 2: Verify dev server still compiles**

Check the running dev server output — no CSS errors expected.

---

### Task 3: Create ExpandPanel

**Files:**
- Create: `components/layout/ExpandPanel.tsx`

Adapted directly from `teable-develop/packages/sdk/src/components/expand-record/Panel.tsx`. Swapped: `@teable/ui-lib` cn → `@/lib/utils`, removed SDK deps, replaced `useLocalStorage` with manual localStorage + useState, replaced `useIsTouchDevice` with `false` (desktop-only tool for now).

- [ ] **Step 1: Create the file**

```tsx
"use client"

import {
  useCallback, useEffect, useMemo, useRef, useState,
  type FC, type PropsWithChildren,
} from "react"
import { cn } from "@/lib/utils"

const MIN_SIZE = 300
const DEFAULT_SIZE = 600
const STORAGE_KEY = "expand-panel-size"

export const ExpandPanel: FC<PropsWithChildren<{ className?: string; visible?: boolean }>> = ({
  children, visible, className,
}) => {
  const [size, setSize] = useState<number>(() => {
    if (typeof window === "undefined") return DEFAULT_SIZE
    return Number(localStorage.getItem(STORAGE_KEY)) || DEFAULT_SIZE
  })
  const [sashSize, setSashSize] = useState(0)
  const sashRef = useRef<HTMLDivElement>(null)
  const draggingRef = useRef(false)

  useEffect(() => {
    setSashSize(sashRef.current?.offsetWidth ?? 0)
  }, [])

  const right = useMemo(() => (size ? size - sashSize / 2 : 0), [size, sashSize])

  const onPointerMove = useCallback((e: PointerEvent) => {
    e.preventDefault()
    if (!draggingRef.current) return
    const newSize = Math.max(document.body.clientWidth - e.pageX, MIN_SIZE)
    setSize(newSize)
    localStorage.setItem(STORAGE_KEY, String(newSize))
  }, [])

  const onPointerUp = useCallback(() => {
    draggingRef.current = false
    window.removeEventListener("pointermove", onPointerMove)
    window.removeEventListener("pointerup", onPointerUp)
  }, [onPointerMove])

  const onPointerDown = useCallback(() => {
    draggingRef.current = true
    window.addEventListener("pointermove", onPointerMove)
    window.addEventListener("pointerup", onPointerUp)
  }, [onPointerMove, onPointerUp])

  if (!visible) return <>{children}</>

  return (
    <div
      className={cn(
        "absolute h-full top-0 right-0 bg-background z-20",
        "before:absolute before:w-px before:h-full before:top-0 before:bg-[var(--separator-border)]",
        className
      )}
      style={{ width: size + "px" }}
    >
      <div
        ref={sashRef}
        className={cn(
          "absolute w-[var(--sash-size)] h-full top-0 cursor-col-resize z-10",
          "before:absolute before:w-[var(--sash-hover-size)] before:h-full",
          "before:left-[calc(50%-(var(--sash-hover-size)/2))]",
          "before:transition-colors before:duration-100",
          "before:hover:bg-[var(--focus-border)]"
        )}
        style={{ right: right + "px" }}
        onPointerDown={onPointerDown}
      />
      {children}
    </div>
  )
}
```

- [ ] **Step 2: TypeScript check**

Run:
```
cd "C:\Users\This PC\Gravity\SIDE APPS\workstation" && npx tsc --noEmit 2>&1
```

Expected: no errors from this file.

---

### Task 4: Create AppSidebar

**Files:**
- Create: `components/layout/AppSidebar.tsx`

Adapted from `teable-develop/apps/nextjs-app/src/features/app/components/sidebar/Sidebar.tsx`. Stripped: mobile SheetWrapper, HoverWrapper, SidebarHeader, useSidebarStore, all SDK imports. Kept: `re-resizable` resize, collapse/expand toggle, `react-hotkeys-hook` Mod+B shortcut.

- [ ] **Step 1: Create the file**

```tsx
"use client"

import { ChevronsLeft, ChevronsRight } from "lucide-react"
import { Resizable } from "re-resizable"
import { useCallback, useState, type FC, type PropsWithChildren } from "react"
import { useHotkeys } from "react-hotkeys-hook"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"

const MIN_WIDTH = 180
const MAX_WIDTH = 400
const DEFAULT_WIDTH = 220

export const AppSidebar: FC<PropsWithChildren<{ className?: string }>> = ({
  children,
  className,
}) => {
  const [visible, setVisible] = useState(true)
  const [width, setWidth] = useState(DEFAULT_WIDTH)

  const toggle = useCallback(() => setVisible((v) => !v), [])
  useHotkeys("mod+b", toggle)

  if (!visible) {
    return (
      <div className="relative shrink-0">
        <Button
          variant="outline"
          size="sm"
          className="fixed left-0 top-6 z-40 rounded-none rounded-r-full px-1 h-7"
          onClick={toggle}
          title="Show sidebar (Mod+B)"
        >
          <ChevronsRight size={14} />
        </Button>
      </div>
    )
  }

  return (
    <Resizable
      className="h-full shrink-0 border-r bg-background"
      size={{ width, height: "100%" }}
      defaultSize={{ width: DEFAULT_WIDTH, height: "100%" }}
      minWidth={MIN_WIDTH}
      maxWidth={MAX_WIDTH}
      enable={{ right: true }}
      onResizeStop={(_e, _d, ref) => {
        const w = parseInt(ref.style.width, 10)
        if (!isNaN(w)) {
          if (w <= MIN_WIDTH) setVisible(false)
          else setWidth(w)
        }
      }}
      handleClasses={{ right: "group" }}
      handleStyles={{ right: { width: "6px", right: "-6px" } }}
      handleComponent={{
        right: (
          <div className="h-full w-px bg-transparent transition-colors group-hover:bg-primary/50 group-active:bg-primary" />
        ),
      }}
    >
      <div className={cn("flex h-full flex-col overflow-hidden", className)}>
        <div className="flex h-10 items-center justify-between px-3 border-b shrink-0">
          <span className="text-sm font-semibold text-neutral-700">Workstation</span>
          <Button
            variant="ghost"
            size="sm"
            className="h-6 w-6 p-0 text-neutral-400"
            onClick={toggle}
            title="Hide sidebar (Mod+B)"
          >
            <ChevronsLeft size={14} />
          </Button>
        </div>
        {children}
      </div>
    </Resizable>
  )
}
```

- [ ] **Step 2: TypeScript check**

Run:
```
cd "C:\Users\This PC\Gravity\SIDE APPS\workstation" && npx tsc --noEmit 2>&1
```

Expected: no errors.

---

### Task 5: Rewrite ListingsGrid with glide-data-grid

**Files:**
- Rewrite: `components/grid/ListingsGrid.tsx`
- Delete: `components/grid/MediaCell.tsx`

The grid uses `DataEditor` from glide-data-grid. A `ResizeObserver` measures the container and passes explicit `width`/`height` to `DataEditor` (required for canvas sizing). `ExpandPanel` is rendered absolutely over the grid when a row is selected.

- [ ] **Step 1: Delete MediaCell.tsx**

Delete `components/grid/MediaCell.tsx` — no longer used.

- [ ] **Step 2: Write the new ListingsGrid.tsx**

```tsx
"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import DataEditor, {
  CompactSelection,
  GridCellKind,
  type GridCell,
  type GridColumn,
  type GridSelection,
  type Item,
} from "@glideapps/glide-data-grid"
import "@glideapps/glide-data-grid/dist/index.css"
import type { Listing } from "@/types/listing"
import { ExpandPanel } from "@/components/layout/ExpandPanel"
import ListingPanel from "@/components/panel/ListingPanel"
import { Button } from "@/components/ui/button"
import { Plus } from "lucide-react"
import { toast } from "sonner"

const COLUMNS: GridColumn[] = [
  { title: "Title", width: 320, id: "title" },
  { title: "Price", width: 90, id: "price" },
  { title: "Tags", width: 80, id: "tags" },
  { title: "Status", width: 110, id: "status" },
]

const EMPTY_SELECTION: GridSelection = {
  columns: CompactSelection.empty(),
  rows: CompactSelection.empty(),
  current: undefined,
}

export default function ListingsGrid() {
  const [listings, setListings] = useState<Listing[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [gridSelection, setGridSelection] = useState<GridSelection>(EMPTY_SELECTION)
  const containerRef = useRef<HTMLDivElement>(null)
  const [dims, setDims] = useState({ width: 0, height: 0 })

  const selectedListing = listings.find((l) => l.id === selectedId) ?? null

  // Measure container for DataEditor
  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const ro = new ResizeObserver((entries) => {
      const { width, height } = entries[0].contentRect
      setDims({ width, height })
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  // Fetch listings on mount
  const fetchListings = useCallback(async () => {
    const res = await fetch("/api/listings")
    const data = await res.json()
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

  const addListing = useCallback(async () => {
    const res = await fetch("/api/listings", { method: "POST" })
    const raw = await res.json()
    const listing: Listing = { ...raw, images: [], tags: [], digitalFiles: [] }
    setListings((prev) => [listing, ...prev])
    setSelectedId(listing.id)
    setGridSelection({
      ...EMPTY_SELECTION,
      rows: CompactSelection.fromSingleSelection(0),
    })
  }, [])

  const updateListing = useCallback((updated: Listing) => {
    setListings((prev) => prev.map((l) => (l.id === updated.id ? updated : l)))
  }, [])

  const closePanel = useCallback(() => {
    setSelectedId(null)
    setGridSelection(EMPTY_SELECTION)
  }, [])

  // Cell content for glide-data-grid
  const getCellContent = useCallback(
    ([col, row]: Item): GridCell => {
      const listing = listings[row]
      if (!listing) return { kind: GridCellKind.Loading, allowOverlay: false }
      switch (col) {
        case 0:
          return {
            kind: GridCellKind.Text,
            data: listing.title || "",
            displayData: listing.title || "Untitled",
            allowOverlay: false,
          }
        case 1:
          return {
            kind: GridCellKind.Text,
            data: listing.price != null ? `$${listing.price.toFixed(2)}` : "—",
            displayData: listing.price != null ? `$${listing.price.toFixed(2)}` : "—",
            allowOverlay: false,
          }
        case 2:
          return {
            kind: GridCellKind.Text,
            data: `${listing.tags.length}/13`,
            displayData: `${listing.tags.length}/13`,
            allowOverlay: false,
          }
        case 3:
          return {
            kind: GridCellKind.Text,
            data: listing.status,
            displayData: listing.status,
            allowOverlay: false,
          }
        default:
          return { kind: GridCellKind.Loading, allowOverlay: false }
      }
    },
    [listings]
  )

  const onCellClicked = useCallback(
    ([, row]: Item) => {
      const listing = listings[row]
      if (!listing) return
      if (listing.id === selectedId) {
        closePanel()
      } else {
        setSelectedId(listing.id)
        setGridSelection({
          ...EMPTY_SELECTION,
          rows: CompactSelection.fromSingleSelection(row),
        })
      }
    },
    [listings, selectedId, closePanel]
  )

  return (
    <div className="h-full flex flex-col">
      {/* Toolbar */}
      <div className="flex items-center justify-between px-4 py-2 border-b bg-white shrink-0">
        <Button size="sm" onClick={addListing} className="gap-1.5">
          <Plus size={14} /> New Listing
        </Button>
        <span className="text-xs text-neutral-400">{listings.length} listing{listings.length !== 1 ? "s" : ""}</span>
      </div>

      {/* Grid + right-side expand panel */}
      <div ref={containerRef} className="relative flex-1 overflow-hidden">
        {dims.width > 0 && (
          <DataEditor
            columns={COLUMNS}
            getCellContent={getCellContent}
            rows={listings.length}
            width={dims.width}
            height={dims.height}
            rowMarkers="clickable-number"
            onCellClicked={onCellClicked}
            gridSelection={gridSelection}
            onGridSelectionChange={setGridSelection}
            smoothScrollX
            smoothScrollY
            onRowAppended={addListing}
            trailingRowOptions={{ hint: "New listing…", sticky: true, tint: true }}
          />
        )}

        <ExpandPanel visible={!!selectedListing}>
          {selectedListing && (
            <ListingPanel
              listing={selectedListing}
              onUpdate={updateListing}
              onClose={closePanel}
            />
          )}
        </ExpandPanel>
      </div>
    </div>
  )
}
```

- [ ] **Step 3: TypeScript check**

Run:
```
cd "C:\Users\This PC\Gravity\SIDE APPS\workstation" && npx tsc --noEmit 2>&1
```

Expected: no errors.

---

### Task 6: Rewrite WorkstationLayout

**Files:**
- Rewrite: `components/workstation/WorkstationLayout.tsx`

Replace the old narrow dark sidebar with `AppSidebar`. The header moves inside the sidebar. Platform content (Etsy entry) lives in the sidebar body.

- [ ] **Step 1: Write the new WorkstationLayout.tsx**

```tsx
"use client"

import { Package } from "lucide-react"
import { AppSidebar } from "@/components/layout/AppSidebar"

export default function WorkstationLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-full w-full overflow-hidden">
      <AppSidebar>
        <nav className="flex-1 p-2 space-y-0.5">
          <div className="flex items-center gap-2 rounded-md px-2 py-1.5 bg-orange-50 text-orange-700 cursor-pointer">
            <Package size={15} />
            <span className="text-xs font-medium">Etsy</span>
          </div>
        </nav>
      </AppSidebar>

      <main className="flex-1 min-w-0 overflow-hidden">{children}</main>
    </div>
  )
}
```

- [ ] **Step 2: Full TypeScript check**

Run:
```
cd "C:\Users\This PC\Gravity\SIDE APPS\workstation" && npx tsc --noEmit 2>&1
```

Expected: no errors.

- [ ] **Step 3: Verify in browser**

Open `http://localhost:3000`. Confirm:
- Left sidebar is visible and resizable (drag the right edge)
- Mod+B toggles it closed/open
- Grid renders with Title / Price / Tags / Status columns
- Clicking a row opens the expand panel on the right
- Dragging the panel's left edge resizes it
- Clicking the same row again closes the panel
- "New Listing" button adds a row and opens the panel
- Save Draft saves without the panel closing or losing focus
