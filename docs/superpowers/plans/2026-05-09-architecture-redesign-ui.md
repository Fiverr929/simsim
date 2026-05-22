# Architecture Redesign — UI Rebuild (Plan 2 of 2)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace all hardcoded Etsy UI with a dynamic Airtable-like interface: Space switcher in top nav, Base/Table tree in sidebar, dynamic grid with inline editing, record expansion modal, and gallery/kanban views wired to dynamic fields.

**Architecture:** `AppContext` holds the active space/base/table/view IDs. `useTable` and `useRecords` hooks fetch data from the Plan 1 API. The grid, gallery, and kanban all read from `table.fields` and `records[].data` — no hardcoded column names anywhere. Inline cell edits PATCH `/api/records/[id]` with a partial `data` merge.

**Tech Stack:** Next.js 16, React 19, glide-data-grid v6, @dnd-kit, Tailwind CSS, types from `types/core.ts`.

---

## File Map

**Create:**
- `components/app/AppContext.tsx` — active IDs context + setters
- `components/app/AppShell.tsx` — full layout: TopNav + sidebar + main
- `components/app/TopNav.tsx` — space switcher dropdown
- `components/app/BaseSidebar.tsx` — bases + tables tree
- `components/app/ViewTabs.tsx` — view tab strip + add view
- `hooks/useTable.ts` — fetch table with fields + views
- `hooks/useRecords.ts` — fetch + optimistic-update records
- `components/table/TableView.tsx` — routes to correct view component
- `components/table/DynamicGrid.tsx` — glide grid wired to dynamic fields
- `components/table/RecordModal.tsx` — full record expansion modal
- `components/table/DynamicGallery.tsx` — gallery with configurable cover field
- `components/table/DynamicKanban.tsx` — kanban with configurable group field
- `components/table/FieldMenu.tsx` — column header right-click: rename, delete

**Modify:**
- `app/page.tsx` — render `<AppShell />`

**Keep (not breaking anything, UI components not imported by new code):**
- `components/grid/`, `components/panel/`, `components/workstation/` — left in place, just not used

---

## Task 1: AppContext

**Files:**
- Create: `components/app/AppContext.tsx`

- [ ] **Step 1: Create AppContext**

```typescript
"use client"

import { createContext, useCallback, useContext, useState, type ReactNode } from "react"

interface AppState {
  activeSpaceId: string | null
  activeBaseId: string | null
  activeTableId: string | null
  activeViewId: string | null
  setActiveSpaceId: (id: string | null) => void
  setActiveBaseId: (id: string | null) => void
  setActiveTableId: (id: string | null) => void
  setActiveViewId: (id: string | null) => void
  openTable: (tableId: string, viewId?: string) => void
}

const AppContext = createContext<AppState | null>(null)

export function AppProvider({ children }: { children: ReactNode }) {
  const [activeSpaceId, setActiveSpaceId] = useState<string | null>(null)
  const [activeBaseId, setActiveBaseId] = useState<string | null>(null)
  const [activeTableId, setActiveTableId] = useState<string | null>(null)
  const [activeViewId, setActiveViewId] = useState<string | null>(null)

  const openTable = useCallback((tableId: string, viewId?: string) => {
    setActiveTableId(tableId)
    setActiveViewId(viewId ?? null)
  }, [])

  return (
    <AppContext.Provider value={{
      activeSpaceId, activeBaseId, activeTableId, activeViewId,
      setActiveSpaceId, setActiveBaseId, setActiveTableId, setActiveViewId,
      openTable,
    }}>
      {children}
    </AppContext.Provider>
  )
}

export function useApp() {
  const ctx = useContext(AppContext)
  if (!ctx) throw new Error("useApp must be used inside AppProvider")
  return ctx
}
```

---

## Task 2: Data Hooks

**Files:**
- Create: `hooks/useTable.ts`
- Create: `hooks/useRecords.ts`

- [ ] **Step 1: Create `hooks/useTable.ts`**

```typescript
import { useCallback, useEffect, useState } from "react"
import type { AppTable } from "@/types/core"

export function useTable(tableId: string | null) {
  const [table, setTable] = useState<AppTable | null>(null)
  const [loading, setLoading] = useState(false)

  const fetchTable = useCallback(async (id: string) => {
    setLoading(true)
    try {
      const res = await fetch(`/api/tables/${id}`)
      if (res.ok) setTable(await res.json())
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (tableId) fetchTable(tableId)
    else setTable(null)
  }, [tableId, fetchTable])

  return { table, loading, refetch: () => tableId && fetchTable(tableId) }
}
```

- [ ] **Step 2: Create `hooks/useRecords.ts`**

```typescript
import { useCallback, useEffect, useState } from "react"
import type { AppRecord, CellValue } from "@/types/core"

export function useRecords(tableId: string | null) {
  const [records, setRecords] = useState<AppRecord[]>([])
  const [loading, setLoading] = useState(false)

  const fetchRecords = useCallback(async (id: string) => {
    setLoading(true)
    try {
      const res = await fetch(`/api/records?tableId=${id}`)
      if (res.ok) setRecords(await res.json())
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (tableId) fetchRecords(tableId)
    else setRecords([])
  }, [tableId, fetchRecords])

  const addRecord = useCallback(async () => {
    if (!tableId) return null
    const res = await fetch("/api/records", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tableId, data: {} }),
    })
    if (!res.ok) return null
    const record: AppRecord = await res.json()
    setRecords((prev) => [...prev, record])
    return record
  }, [tableId])

  const updateRecord = useCallback(async (id: string, data: Record<string, CellValue>) => {
    setRecords((prev) =>
      prev.map((r) => (r.id === id ? { ...r, data: { ...r.data, ...data } } : r))
    )
    await fetch(`/api/records/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ data }),
    })
  }, [])

  const deleteRecord = useCallback(async (id: string) => {
    setRecords((prev) => prev.filter((r) => r.id !== id))
    await fetch(`/api/records/${id}`, { method: "DELETE" })
  }, [])

  return { records, loading, addRecord, updateRecord, deleteRecord, refetch: () => tableId && fetchRecords(tableId) }
}
```

---

## Task 3: TopNav

**Files:**
- Create: `components/app/TopNav.tsx`

- [ ] **Step 1: Create `components/app/TopNav.tsx`**

```typescript
"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { ChevronDown, Plus, Check } from "lucide-react"
import { useApp } from "@/components/app/AppContext"
import type { Space } from "@/types/core"
import { cn } from "@/lib/utils"

export function TopNav() {
  const { activeSpaceId, setActiveSpaceId, setActiveBaseId, setActiveTableId, setActiveViewId } = useApp()
  const [spaces, setSpaces] = useState<Space[]>([])
  const [open, setOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const ref = useRef<HTMLDivElement>(null)

  const fetchSpaces = useCallback(async () => {
    const res = await fetch("/api/spaces")
    const data: Space[] = await res.json()
    setSpaces(data)
    if (data.length > 0 && !activeSpaceId) setActiveSpaceId(data[0].id)
  }, [activeSpaceId, setActiveSpaceId])

  useEffect(() => { fetchSpaces() }, [fetchSpaces])

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener("mousedown", handler)
    return () => document.removeEventListener("mousedown", handler)
  }, [])

  const activeSpace = spaces.find((s) => s.id === activeSpaceId)

  const createSpace = async () => {
    const res = await fetch("/api/spaces", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "New Space" }),
    })
    const space: Space = await res.json()
    setSpaces((prev) => [...prev, space])
    setEditingId(space.id)
  }

  const renameSpace = async (id: string, name: string) => {
    setEditingId(null)
    const trimmed = name.trim() || "Untitled"
    setSpaces((prev) => prev.map((s) => (s.id === id ? { ...s, name: trimmed } : s)))
    await fetch(`/api/spaces/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: trimmed }),
    })
  }

  const switchSpace = (id: string) => {
    setActiveSpaceId(id)
    setActiveBaseId(null)
    setActiveTableId(null)
    setActiveViewId(null)
    setOpen(false)
  }

  return (
    <div className="h-10 flex items-center px-3 border-b bg-white shrink-0 gap-2">
      <span className="text-xs font-bold text-neutral-400 tracking-widest uppercase mr-1">Workstation</span>
      <div className="w-px h-4 bg-neutral-200" />

      <div ref={ref} className="relative">
        <button
          className="flex items-center gap-1.5 text-sm font-medium text-neutral-700 hover:text-neutral-900 px-2 py-1 rounded hover:bg-neutral-100"
          onClick={() => setOpen((v) => !v)}
        >
          <span>{activeSpace?.icon ?? "🏠"}</span>
          <span>{activeSpace?.name ?? "Select space…"}</span>
          <ChevronDown size={13} className="text-neutral-400" />
        </button>

        {open && (
          <div className="absolute left-0 top-full mt-1 z-50 w-56 rounded-lg border bg-white shadow-lg py-1">
            <p className="px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-neutral-400">Spaces</p>
            {spaces.map((s) => (
              <div key={s.id} className="relative">
                {editingId === s.id ? (
                  <input
                    autoFocus
                    defaultValue={s.name}
                    className="w-full text-sm px-3 py-1.5 outline-none border-b border-blue-300 bg-blue-50"
                    onBlur={(e) => renameSpace(s.id, e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") renameSpace(s.id, e.currentTarget.value)
                      if (e.key === "Escape") setEditingId(null)
                    }}
                  />
                ) : (
                  <button
                    className="w-full flex items-center justify-between gap-2 px-3 py-1.5 text-sm text-neutral-700 hover:bg-neutral-50"
                    onClick={() => switchSpace(s.id)}
                    onDoubleClick={() => setEditingId(s.id)}
                  >
                    <span className="flex items-center gap-2"><span>{s.icon}</span>{s.name}</span>
                    {s.id === activeSpaceId && <Check size={13} className="text-blue-500" />}
                  </button>
                )}
              </div>
            ))}
            <div className="border-t mt-1 pt-1">
              <button
                className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-neutral-500 hover:bg-neutral-50"
                onClick={createSpace}
              >
                <Plus size={12} /> New space
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
```

---

## Task 4: BaseSidebar

**Files:**
- Create: `components/app/BaseSidebar.tsx`

- [ ] **Step 1: Create `components/app/BaseSidebar.tsx`**

```typescript
"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { ChevronRight, ChevronDown, Plus, MoreHorizontal, Table2, Database, Trash2, Pencil } from "lucide-react"
import { useApp } from "@/components/app/AppContext"
import type { Base, AppTable } from "@/types/core"
import { cn } from "@/lib/utils"

interface BaseWithTables extends Omit<Base, "tables"> {
  tables: Pick<AppTable, "id" | "name" | "order" | "baseId">[]
}

export function BaseSidebar() {
  const { activeSpaceId, activeTableId, openTable, setActiveBaseId } = useApp()
  const [bases, setBases] = useState<BaseWithTables[]>([])
  const [expanded, setExpanded] = useState<Set<string>>(new Set())
  const [menuId, setMenuId] = useState<string | null>(null)
  const [editingId, setEditingId] = useState<string | null>(null)
  const editRef = useRef<HTMLInputElement>(null)

  const fetchBases = useCallback(async () => {
    if (!activeSpaceId) return
    const res = await fetch(`/api/bases?spaceId=${activeSpaceId}`)
    const data: BaseWithTables[] = await res.json()
    setBases(data)
    if (data.length > 0) setExpanded(new Set([data[0].id]))
  }, [activeSpaceId])

  useEffect(() => { fetchBases() }, [fetchBases])
  useEffect(() => { if (editingId && editRef.current) editRef.current.focus() }, [editingId])

  const addBase = async () => {
    if (!activeSpaceId) return
    const res = await fetch("/api/bases", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "New Base", spaceId: activeSpaceId }),
    })
    const base: BaseWithTables = await res.json()
    setBases((prev) => [...prev, base])
    setExpanded((prev) => new Set([...prev, base.id]))
    setEditingId(base.id)
  }

  const renameBase = async (id: string, name: string) => {
    setEditingId(null)
    const trimmed = name.trim() || "Untitled"
    setBases((prev) => prev.map((b) => (b.id === id ? { ...b, name: trimmed } : b)))
    await fetch(`/api/bases/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: trimmed }),
    })
  }

  const deleteBase = async (id: string) => {
    setMenuId(null)
    setBases((prev) => prev.filter((b) => b.id !== id))
    await fetch(`/api/bases/${id}`, { method: "DELETE" })
  }

  const addTable = async (baseId: string) => {
    const res = await fetch("/api/tables", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "Table", baseId }),
    })
    const table = await res.json()
    setBases((prev) =>
      prev.map((b) => b.id === baseId ? { ...b, tables: [...b.tables, table] } : b)
    )
    openTable(table.id, table.views?.[0]?.id)
    setActiveBaseId(baseId)
  }

  const deleteTable = async (baseId: string, tableId: string) => {
    setMenuId(null)
    setBases((prev) =>
      prev.map((b) => b.id === baseId ? { ...b, tables: b.tables.filter((t) => t.id !== tableId) } : b)
    )
    await fetch(`/api/tables/${tableId}`, { method: "DELETE" })
  }

  const toggleBase = (id: string) => {
    setExpanded((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  if (!activeSpaceId) return (
    <div className="flex-1 flex items-center justify-center text-xs text-neutral-400 p-4 text-center">
      Select a space to see your bases
    </div>
  )

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="flex-1 overflow-y-auto p-2 space-y-1">
        {bases.map((base) => (
          <div key={base.id}>
            {/* Base row */}
            <div className="group flex items-center gap-1 rounded-md px-1 py-1 hover:bg-neutral-100 relative">
              <button onClick={() => toggleBase(base.id)} className="p-0.5 text-neutral-400">
                {expanded.has(base.id) ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
              </button>
              <span className="text-sm">{base.icon}</span>
              {editingId === base.id ? (
                <input
                  ref={editRef}
                  defaultValue={base.name}
                  className="flex-1 text-xs outline-none bg-transparent"
                  onBlur={(e) => renameBase(base.id, e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") renameBase(base.id, e.currentTarget.value)
                    if (e.key === "Escape") setEditingId(null)
                  }}
                />
              ) : (
                <span className="flex-1 text-xs font-semibold text-neutral-700 truncate">{base.name}</span>
              )}
              <button
                className="opacity-0 group-hover:opacity-100 p-0.5 text-neutral-400 hover:text-neutral-700 rounded"
                onClick={(e) => { e.stopPropagation(); setMenuId(menuId === base.id ? null : base.id) }}
              >
                <MoreHorizontal size={12} />
              </button>

              {menuId === base.id && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setMenuId(null)} />
                  <div className="absolute right-0 top-full mt-0.5 z-50 w-36 rounded-md border bg-white shadow-md py-1">
                    <button className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-neutral-700 hover:bg-neutral-50"
                      onClick={() => { setMenuId(null); setEditingId(base.id) }}>
                      <Pencil size={11} /> Rename
                    </button>
                    <button className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-red-600 hover:bg-red-50"
                      onClick={() => deleteBase(base.id)}>
                      <Trash2 size={11} /> Delete base
                    </button>
                  </div>
                </>
              )}
            </div>

            {/* Tables */}
            {expanded.has(base.id) && (
              <div className="ml-5 space-y-0.5">
                {base.tables.map((table) => (
                  <div key={table.id} className="group flex items-center gap-1.5 rounded-md px-2 py-1 hover:bg-neutral-100 relative cursor-pointer"
                    onClick={() => { openTable(table.id); setActiveBaseId(base.id) }}>
                    <Table2 size={12} className={cn("shrink-0", activeTableId === table.id ? "text-blue-500" : "text-neutral-400")} />
                    <span className={cn("flex-1 text-xs truncate", activeTableId === table.id ? "text-blue-600 font-medium" : "text-neutral-600")}>
                      {table.name}
                    </span>
                    <button
                      className="opacity-0 group-hover:opacity-100 p-0.5 text-neutral-400 hover:text-red-500 rounded"
                      onClick={(e) => { e.stopPropagation(); deleteTable(base.id, table.id) }}
                      title="Delete table"
                    >
                      <Trash2 size={10} />
                    </button>
                  </div>
                ))}
                <button
                  className="flex items-center gap-1.5 px-2 py-1 text-xs text-neutral-400 hover:text-neutral-600 w-full rounded hover:bg-neutral-100"
                  onClick={() => addTable(base.id)}
                >
                  <Plus size={11} /> Add table
                </button>
              </div>
            )}
          </div>
        ))}
      </div>

      <div className="p-2 border-t shrink-0">
        <button
          className="flex items-center gap-1.5 w-full px-2 py-1.5 text-xs text-neutral-500 hover:bg-neutral-100 rounded-md"
          onClick={addBase}
        >
          <Plus size={12} /> <Database size={12} /> Add base
        </button>
      </div>
    </div>
  )
}
```

---

## Task 5: ViewTabs

**Files:**
- Create: `components/app/ViewTabs.tsx`

- [ ] **Step 1: Create `components/app/ViewTabs.tsx`**

```typescript
"use client"

import { useState } from "react"
import { Plus, List, LayoutGrid, Columns3, Calendar, FileText } from "lucide-react"
import { useApp } from "@/components/app/AppContext"
import type { View, ViewType } from "@/types/core"
import { cn } from "@/lib/utils"

const VIEW_ICONS: Record<ViewType, React.ReactNode> = {
  grid: <List size={12} />,
  gallery: <LayoutGrid size={12} />,
  kanban: <Columns3 size={12} />,
  calendar: <Calendar size={12} />,
  form: <FileText size={12} />,
}

interface Props {
  views: View[]
  onViewAdded: (view: View) => void
}

export function ViewTabs({ views, onViewAdded }: Props) {
  const { activeTableId, activeViewId, setActiveViewId } = useApp()
  const [showAddMenu, setShowAddMenu] = useState(false)

  const addView = async (type: ViewType) => {
    if (!activeTableId) return
    setShowAddMenu(false)
    const names: Record<ViewType, string> = {
      grid: "Grid", gallery: "Gallery", kanban: "Kanban", calendar: "Calendar", form: "Form",
    }
    const res = await fetch("/api/views", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tableId: activeTableId, type, name: names[type] }),
    })
    const view: View = await res.json()
    onViewAdded(view)
    setActiveViewId(view.id)
  }

  return (
    <div className="flex items-center gap-0.5 px-3 border-b bg-white shrink-0 h-9 overflow-x-auto">
      {views.map((v) => (
        <button
          key={v.id}
          onClick={() => setActiveViewId(v.id)}
          className={cn(
            "flex items-center gap-1.5 px-3 h-full text-xs border-b-2 transition-colors shrink-0",
            activeViewId === v.id
              ? "border-blue-500 text-blue-600 font-medium"
              : "border-transparent text-neutral-500 hover:text-neutral-700"
          )}
        >
          {VIEW_ICONS[v.type as ViewType]}
          {v.name}
        </button>
      ))}

      <div className="relative ml-1">
        <button
          className="flex items-center gap-1 px-2 py-1 text-xs text-neutral-400 hover:text-neutral-600 hover:bg-neutral-100 rounded"
          onClick={() => setShowAddMenu((v) => !v)}
        >
          <Plus size={12} /> Add view
        </button>
        {showAddMenu && (
          <>
            <div className="fixed inset-0 z-40" onClick={() => setShowAddMenu(false)} />
            <div className="absolute left-0 top-full mt-1 z-50 w-36 rounded-md border bg-white shadow-md py-1">
              {(["grid", "gallery", "kanban", "calendar", "form"] as ViewType[]).map((type) => (
                <button key={type} className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-neutral-700 hover:bg-neutral-50 capitalize"
                  onClick={() => addView(type)}>
                  {VIEW_ICONS[type]} {type}
                </button>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  )
}
```

---

## Task 6: DynamicGrid

**Files:**
- Create: `components/table/DynamicGrid.tsx`

- [ ] **Step 1: Create `components/table/DynamicGrid.tsx`**

```typescript
"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import DataEditor, {
  CompactSelection,
  GridCellKind,
  type EditableGridCell,
  type GridCell,
  type GridColumn,
  type GridSelection,
  type Item,
} from "@glideapps/glide-data-grid"
import "@glideapps/glide-data-grid/dist/index.css"
import type { AppRecord, CellValue, Field } from "@/types/core"
import { Plus } from "lucide-react"

const FIELD_WIDTHS: Record<string, number> = {
  text: 200, longText: 250, number: 100, singleSelect: 150,
  multiSelect: 200, date: 130, checkbox: 70, attachment: 100, url: 180,
}

const EMPTY_SELECTION: GridSelection = {
  columns: CompactSelection.empty(),
  rows: CompactSelection.empty(),
  current: undefined,
}

interface Props {
  fields: Field[]
  records: AppRecord[]
  hiddenFieldIds?: string[]
  rowHeight?: number
  onRecordUpdate: (id: string, data: Record<string, CellValue>) => void
  onRecordAdd: () => void
  onRecordDelete: (id: string) => void
  onRecordExpand: (record: AppRecord) => void
  onAddField: () => void
}

function cellForField(field: Field, value: CellValue): GridCell {
  switch (field.type) {
    case "number":
      return {
        kind: GridCellKind.Number,
        data: typeof value === "number" ? value : value != null ? Number(value) : undefined,
        displayData: value != null ? String(value) : "",
        allowOverlay: true,
      }
    case "checkbox":
      return { kind: GridCellKind.Boolean, data: Boolean(value), allowOverlay: false }
    case "url":
      return {
        kind: GridCellKind.Uri,
        data: typeof value === "string" ? value : "",
        allowOverlay: true,
      }
    default:
      return {
        kind: GridCellKind.Text,
        data: Array.isArray(value) ? value.join(", ") : value != null ? String(value) : "",
        displayData: Array.isArray(value) ? value.join(", ") : value != null ? String(value) : "",
        allowOverlay: true,
      }
  }
}

export function DynamicGrid({ fields, records, hiddenFieldIds = [], rowHeight = 34, onRecordUpdate, onRecordAdd, onRecordDelete, onRecordExpand, onAddField }: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [dims, setDims] = useState({ width: 0, height: 0 })
  const [gridSelection, setGridSelection] = useState<GridSelection>(EMPTY_SELECTION)
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; recordId: string } | null>(null)
  const [confirmId, setConfirmId] = useState<string | null>(null)

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

  const visibleFields = useMemo(
    () => fields.filter((f) => !hiddenFieldIds.includes(f.id)),
    [fields, hiddenFieldIds]
  )

  const columns = useMemo<GridColumn[]>(
    () => visibleFields.map((f) => ({ title: f.name, width: FIELD_WIDTHS[f.type] ?? 150, id: f.id })),
    [visibleFields]
  )

  const getCellContent = useCallback(
    ([col, row]: Item): GridCell => {
      const record = records[row]
      const field = visibleFields[col]
      if (!record || !field) return { kind: GridCellKind.Loading, allowOverlay: false }
      return cellForField(field, record.data[field.id] ?? null)
    },
    [records, visibleFields]
  )

  const onCellEdited = useCallback(
    ([col, row]: Item, newValue: EditableGridCell) => {
      const record = records[row]
      const field = visibleFields[col]
      if (!record || !field) return
      let value: CellValue = null
      if (newValue.kind === GridCellKind.Text) value = newValue.data
      else if (newValue.kind === GridCellKind.Number) value = newValue.data ?? null
      else if (newValue.kind === GridCellKind.Boolean) value = newValue.data
      else if (newValue.kind === GridCellKind.Uri) value = newValue.data
      onRecordUpdate(record.id, { [field.id]: value })
    },
    [records, visibleFields, onRecordUpdate]
  )

  const onCellContextMenu = useCallback(
    ([, row]: Item, event: { preventDefault: () => void; bounds: { x: number; y: number }; localEventX: number; localEventY: number }) => {
      event.preventDefault()
      const record = records[row]
      if (!record) return
      setContextMenu({ x: event.bounds.x + event.localEventX, y: event.bounds.y + event.localEventY, recordId: record.id })
    },
    [records]
  )

  const onCellClicked = useCallback(
    ([, row]: Item) => {
      const record = records[row]
      if (record) onRecordExpand(record)
    },
    [records, onRecordExpand]
  )

  return (
    <div ref={containerRef} className="relative flex-1 overflow-hidden">
      {dims.width > 0 && (
        <DataEditor
          columns={columns}
          getCellContent={getCellContent}
          rows={records.length}
          width={dims.width}
          height={dims.height}
          rowMarkers="clickable-number"
          onCellEdited={onCellEdited}
          onCellClicked={onCellClicked}
          onCellContextMenu={onCellContextMenu}
          gridSelection={gridSelection}
          onGridSelectionChange={setGridSelection}
          smoothScrollX
          smoothScrollY
          rowHeight={rowHeight}
          onRowAppended={onRecordAdd}
          trailingRowOptions={{ hint: "New record…", sticky: true, tint: true }}
          rightElementProps={{ fill: true, sticky: false }}
          rightElement={
            <button
              className="flex items-center gap-1 px-3 h-full text-xs text-neutral-400 hover:text-neutral-700 hover:bg-neutral-50 border-l whitespace-nowrap"
              onClick={onAddField}
            >
              <Plus size={12} /> Field
            </button>
          }
        />
      )}

      {contextMenu && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setContextMenu(null)} />
          <div
            className="fixed z-50 min-w-36 rounded-lg border bg-white shadow-lg py-1"
            style={{ left: Math.min(contextMenu.x, window.innerWidth - 160), top: Math.min(contextMenu.y, window.innerHeight - 80) }}
          >
            <button
              className="w-full flex items-center gap-2.5 px-3 py-1.5 text-xs text-neutral-700 hover:bg-neutral-50"
              onClick={() => { setContextMenu(null); onRecordExpand(records.find((r) => r.id === contextMenu.recordId)!) }}
            >
              Expand record
            </button>
            <button
              className="w-full flex items-center gap-2.5 px-3 py-1.5 text-xs text-red-600 hover:bg-red-50"
              onClick={() => { setContextMenu(null); setConfirmId(contextMenu.recordId) }}
            >
              Delete record
            </button>
          </div>
        </>
      )}

      {confirmId && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center">
          <div className="absolute inset-0 bg-black/30" onClick={() => setConfirmId(null)} />
          <div className="relative bg-white rounded-xl shadow-xl border p-5 w-72 flex flex-col gap-4">
            <div>
              <p className="text-sm font-semibold text-neutral-900">Delete record?</p>
              <p className="text-xs text-neutral-500 mt-1">This cannot be undone.</p>
            </div>
            <div className="flex justify-end gap-2">
              <button className="px-3 py-1.5 text-xs rounded border hover:bg-neutral-50" onClick={() => setConfirmId(null)}>Cancel</button>
              <button className="px-3 py-1.5 text-xs rounded bg-red-500 text-white hover:bg-red-600"
                onClick={() => { onRecordDelete(confirmId); setConfirmId(null) }}>Delete</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
```

---

## Task 7: RecordModal

**Files:**
- Create: `components/table/RecordModal.tsx`

- [ ] **Step 1: Create `components/table/RecordModal.tsx`**

```typescript
"use client"

import { useEffect, useState } from "react"
import { X } from "lucide-react"
import type { AppRecord, CellValue, Field } from "@/types/core"
import { cn } from "@/lib/utils"

interface Props {
  record: AppRecord
  fields: Field[]
  onUpdate: (id: string, data: Record<string, CellValue>) => void
  onClose: () => void
}

function FieldInput({ field, value, onChange }: { field: Field; value: CellValue; onChange: (v: CellValue) => void }) {
  const str = Array.isArray(value) ? value.join(", ") : value != null ? String(value) : ""

  switch (field.type) {
    case "checkbox":
      return (
        <input
          type="checkbox"
          checked={Boolean(value)}
          onChange={(e) => onChange(e.target.checked)}
          className="w-4 h-4 rounded border-neutral-300"
        />
      )
    case "number":
      return (
        <input
          type="number"
          defaultValue={typeof value === "number" ? value : ""}
          onBlur={(e) => onChange(e.target.value === "" ? null : Number(e.target.value))}
          className="w-full text-sm border rounded px-2 py-1.5 outline-none focus:border-blue-400"
        />
      )
    case "longText":
      return (
        <textarea
          defaultValue={str}
          rows={4}
          onBlur={(e) => onChange(e.target.value || null)}
          className="w-full text-sm border rounded px-2 py-1.5 outline-none focus:border-blue-400 resize-none"
        />
      )
    case "singleSelect": {
      const options = field.config.options ?? []
      return (
        <select
          defaultValue={str}
          onChange={(e) => onChange(e.target.value || null)}
          className="w-full text-sm border rounded px-2 py-1.5 outline-none focus:border-blue-400 bg-white"
        >
          <option value="">—</option>
          {options.map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}
        </select>
      )
    }
    case "date":
      return (
        <input
          type="date"
          defaultValue={str}
          onBlur={(e) => onChange(e.target.value || null)}
          className="w-full text-sm border rounded px-2 py-1.5 outline-none focus:border-blue-400"
        />
      )
    default:
      return (
        <input
          type="text"
          defaultValue={str}
          onBlur={(e) => onChange(e.target.value || null)}
          className="w-full text-sm border rounded px-2 py-1.5 outline-none focus:border-blue-400"
        />
      )
  }
}

export function RecordModal({ record, fields, onUpdate, onClose }: Props) {
  const [data, setData] = useState<Record<string, CellValue>>(record.data)

  useEffect(() => { setData(record.data) }, [record.id])

  const handleChange = (fieldId: string, value: CellValue) => {
    setData((prev) => ({ ...prev, [fieldId]: value }))
    onUpdate(record.id, { [fieldId]: value })
  }

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose() }
    document.addEventListener("keydown", handler)
    return () => document.removeEventListener("keydown", handler)
  }, [onClose])

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-end">
      <div className="absolute inset-0 bg-black/20" onClick={onClose} />
      <div className="relative bg-white h-full w-[480px] shadow-xl flex flex-col border-l overflow-hidden">
        <div className="flex items-center justify-between px-5 py-3 border-b shrink-0">
          <span className="text-sm font-semibold text-neutral-700">Record</span>
          <button onClick={onClose} className="p-1 rounded hover:bg-neutral-100 text-neutral-400">
            <X size={16} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {fields.map((field) => (
            <div key={field.id}>
              <label className="block text-xs font-medium text-neutral-500 mb-1">{field.name}</label>
              <FieldInput
                field={field}
                value={data[field.id] ?? null}
                onChange={(v) => handleChange(field.id, v)}
              />
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
```

---

## Task 8: DynamicGallery + DynamicKanban

**Files:**
- Create: `components/table/DynamicGallery.tsx`
- Create: `components/table/DynamicKanban.tsx`

- [ ] **Step 1: Create `components/table/DynamicGallery.tsx`**

```typescript
"use client"

import { ImageIcon } from "lucide-react"
import type { AppRecord, Field } from "@/types/core"
import { cn } from "@/lib/utils"

interface Props {
  fields: Field[]
  records: AppRecord[]
  onExpand: (record: AppRecord) => void
  onContextMenu: (record: AppRecord, x: number, y: number) => void
}

export function DynamicGallery({ fields, records, onExpand, onContextMenu }: Props) {
  const primaryField = fields.find((f) => f.isPrimary) ?? fields[0]
  const attachmentField = fields.find((f) => f.type === "attachment")
  const statusField = fields.find((f) => f.type === "singleSelect")

  if (records.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-neutral-400 gap-2">
        <ImageIcon size={32} strokeWidth={1} />
        <p className="text-sm">No records yet</p>
      </div>
    )
  }

  return (
    <div className="h-full overflow-y-auto p-4">
      <div className="grid grid-cols-[repeat(auto-fill,minmax(180px,1fr))] gap-3">
        {records.map((record) => {
          const title = primaryField ? String(record.data[primaryField.id] ?? "") : ""
          const statusVal = statusField ? String(record.data[statusField.id] ?? "") : ""
          const statusOption = statusField?.config.options?.find((o) => o.id === statusVal)

          return (
            <button
              key={record.id}
              onClick={() => onExpand(record)}
              onContextMenu={(e) => { e.preventDefault(); onContextMenu(record, e.clientX, e.clientY) }}
              className="group flex flex-col rounded-lg border bg-white overflow-hidden text-left hover:shadow-md transition-shadow"
            >
              <div className="aspect-square bg-neutral-100 flex items-center justify-center text-neutral-300">
                <ImageIcon size={28} strokeWidth={1} />
              </div>
              <div className="p-2.5 flex flex-col gap-1">
                <p className="text-xs font-medium text-neutral-800 truncate">{title || "Untitled"}</p>
                {statusOption && (
                  <span className="text-[10px] px-1.5 py-0.5 rounded-full font-medium self-start"
                    style={{ backgroundColor: statusOption.color + "20", color: statusOption.color }}>
                    {statusOption.label}
                  </span>
                )}
              </div>
            </button>
          )
        })}
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Create `components/table/DynamicKanban.tsx`**

```typescript
"use client"

import { useState } from "react"
import { DndContext, DragOverlay, PointerSensor, useSensor, useSensors, useDroppable, useDraggable, type DragEndEvent, type DragStartEvent } from "@dnd-kit/core"
import { ImageIcon } from "lucide-react"
import type { AppRecord, CellValue, Field, SelectOption } from "@/types/core"
import { cn } from "@/lib/utils"

interface Props {
  fields: Field[]
  records: AppRecord[]
  groupFieldId?: string
  onRecordUpdate: (id: string, data: Record<string, CellValue>) => void
  onExpand: (record: AppRecord) => void
}

export function DynamicKanban({ fields, records, groupFieldId, onRecordUpdate, onExpand }: Props) {
  const [activeId, setActiveId] = useState<string | null>(null)
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }))

  const groupField = fields.find((f) => f.id === groupFieldId) ?? fields.find((f) => f.type === "singleSelect")
  const primaryField = fields.find((f) => f.isPrimary) ?? fields[0]
  const options: SelectOption[] = groupField?.config.options ?? []
  const activeRecord = records.find((r) => r.id === activeId)

  if (!groupField) {
    return (
      <div className="flex items-center justify-center h-full text-neutral-400 text-sm">
        Add a Single Select field to use Kanban view
      </div>
    )
  }

  function onDragStart({ active }: DragStartEvent) { setActiveId(active.id as string) }

  function onDragEnd({ active, over }: DragEndEvent) {
    setActiveId(null)
    if (!over || !groupField) return
    const newVal = over.id as string
    const record = records.find((r) => r.id === active.id)
    if (!record || record.data[groupField.id] === newVal) return
    onRecordUpdate(record.id, { [groupField.id]: newVal })
  }

  return (
    <DndContext sensors={sensors} onDragStart={onDragStart} onDragEnd={onDragEnd}>
      <div className="h-full flex gap-3 p-4 overflow-x-auto">
        {options.map((opt) => {
          const colRecords = records.filter((r) => r.data[groupField.id] === opt.id)
          return (
            <KanbanColumn key={opt.id} option={opt} records={colRecords} primaryField={primaryField}
              onExpand={onExpand} activeId={activeId} />
          )
        })}
        {/* Unassigned column */}
        {(() => {
          const assignedIds = new Set(options.map((o) => o.id))
          const unassigned = records.filter((r) => !assignedIds.has(String(r.data[groupField.id] ?? "")))
          if (unassigned.length === 0) return null
          return (
            <KanbanColumn key="__unassigned" option={{ id: "__unassigned", label: "No status", color: "#a3a3a3" }}
              records={unassigned} primaryField={primaryField} onExpand={onExpand} activeId={activeId} />
          )
        })()}
      </div>
      <DragOverlay>
        {activeRecord && primaryField && (
          <div className="bg-white rounded-lg border p-2.5 shadow-xl rotate-1 text-xs font-medium text-neutral-800">
            {String(activeRecord.data[primaryField.id] ?? "Untitled")}
          </div>
        )}
      </DragOverlay>
    </DndContext>
  )
}

function KanbanColumn({ option, records, primaryField, onExpand, activeId }: {
  option: SelectOption; records: AppRecord[]; primaryField: Field | undefined
  onExpand: (r: AppRecord) => void; activeId: string | null
}) {
  const { setNodeRef, isOver } = useDroppable({ id: option.id })
  return (
    <div className="flex flex-col w-56 shrink-0">
      <div className="flex items-center gap-2 mb-2 px-1">
        <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: option.color }} />
        <span className="text-xs font-semibold text-neutral-700">{option.label}</span>
        <span className="ml-auto text-xs text-neutral-400">{records.length}</span>
      </div>
      <div ref={setNodeRef} className={cn("flex-1 flex flex-col gap-2 rounded-xl p-2 min-h-24 transition-colors", isOver ? "bg-neutral-100" : "bg-neutral-50")}>
        {records.map((r) => <DraggableCard key={r.id} record={r} primaryField={primaryField} onExpand={onExpand} isDragging={activeId === r.id} />)}
      </div>
    </div>
  )
}

function DraggableCard({ record, primaryField, onExpand, isDragging }: {
  record: AppRecord; primaryField: Field | undefined; onExpand: (r: AppRecord) => void; isDragging: boolean
}) {
  const { attributes, listeners, setNodeRef, transform } = useDraggable({ id: record.id })
  return (
    <div ref={setNodeRef} {...listeners} {...attributes}
      style={transform ? { transform: `translate(${transform.x}px,${transform.y}px)` } : undefined}
      className={cn("touch-none", isDragging && "opacity-40")}
      onClick={() => onExpand(record)}
    >
      <div className="bg-white rounded-lg border p-2.5 cursor-pointer hover:shadow-sm">
        <div className="aspect-video bg-neutral-100 rounded mb-2 flex items-center justify-center text-neutral-300">
          <ImageIcon size={16} strokeWidth={1} />
        </div>
        <p className="text-xs font-medium text-neutral-800 truncate">
          {primaryField ? String(record.data[primaryField.id] ?? "Untitled") : "Untitled"}
        </p>
      </div>
    </div>
  )
}
```

---

## Task 9: TableView Orchestrator

**Files:**
- Create: `components/table/TableView.tsx`

- [ ] **Step 1: Create `components/table/TableView.tsx`**

```typescript
"use client"

import { useState } from "react"
import { useApp } from "@/components/app/AppContext"
import { useTable } from "@/hooks/useTable"
import { useRecords } from "@/hooks/useRecords"
import { ViewTabs } from "@/components/app/ViewTabs"
import { DynamicGrid } from "@/components/table/DynamicGrid"
import { DynamicGallery } from "@/components/table/DynamicGallery"
import { DynamicKanban } from "@/components/table/DynamicKanban"
import { RecordModal } from "@/components/table/RecordModal"
import type { AppRecord, View } from "@/types/core"

export function TableView() {
  const { activeTableId, activeViewId, setActiveViewId } = useApp()
  const { table, loading: tableLoading } = useTable(activeTableId)
  const { records, addRecord, updateRecord, deleteRecord } = useRecords(activeTableId)
  const [expandedRecord, setExpandedRecord] = useState<AppRecord | null>(null)
  const [views, setViews] = useState<View[]>([])

  // Sync views from table
  if (table && views.length === 0 && table.views.length > 0) {
    setViews(table.views)
    if (!activeViewId) setActiveViewId(table.views[0].id)
  }

  const activeView = views.find((v) => v.id === activeViewId) ?? views[0]
  const fields = table?.fields ?? []
  const hiddenFieldIds = activeView?.config.hiddenFields ?? []

  const addField = async () => {
    if (!activeTableId) return
    const res = await fetch("/api/fields", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tableId: activeTableId, name: "Field", type: "text" }),
    })
    if (res.ok) {
      const field = await res.json()
      // Refresh table to get updated fields
      window.location.reload()
    }
  }

  if (!activeTableId) {
    return (
      <div className="flex-1 flex items-center justify-center text-neutral-400 text-sm">
        Select a table from the sidebar
      </div>
    )
  }

  if (tableLoading) {
    return <div className="flex-1 flex items-center justify-center text-neutral-400 text-sm">Loading…</div>
  }

  if (!table) return null

  const viewType = activeView?.type ?? "grid"

  return (
    <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
      <ViewTabs
        views={views}
        onViewAdded={(v) => {
          setViews((prev) => [...prev, v])
          setActiveViewId(v.id)
        }}
      />

      <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
        {viewType === "grid" && (
          <DynamicGrid
            fields={fields}
            records={records}
            hiddenFieldIds={hiddenFieldIds}
            rowHeight={activeView?.config.rowHeight ?? 34}
            onRecordUpdate={updateRecord}
            onRecordAdd={addRecord}
            onRecordDelete={deleteRecord}
            onRecordExpand={setExpandedRecord}
            onAddField={addField}
          />
        )}
        {viewType === "gallery" && (
          <DynamicGallery
            fields={fields}
            records={records}
            onExpand={setExpandedRecord}
            onContextMenu={(record, x, y) => setExpandedRecord(record)}
          />
        )}
        {viewType === "kanban" && (
          <DynamicKanban
            fields={fields}
            records={records}
            groupFieldId={activeView?.config.groupFieldId}
            onRecordUpdate={updateRecord}
            onExpand={setExpandedRecord}
          />
        )}
      </div>

      {expandedRecord && (
        <RecordModal
          record={expandedRecord}
          fields={fields}
          onUpdate={updateRecord}
          onClose={() => setExpandedRecord(null)}
        />
      )}
    </div>
  )
}
```

---

## Task 10: AppShell + Wire Up

**Files:**
- Create: `components/app/AppShell.tsx`
- Modify: `app/page.tsx`

- [ ] **Step 1: Create `components/app/AppShell.tsx`**

```typescript
"use client"

import { AppProvider } from "@/components/app/AppContext"
import { TopNav } from "@/components/app/TopNav"
import { AppSidebar } from "@/components/layout/AppSidebar"
import { BaseSidebar } from "@/components/app/BaseSidebar"
import { TableView } from "@/components/table/TableView"

export function AppShell() {
  return (
    <AppProvider>
      <div className="h-full flex flex-col overflow-hidden">
        <TopNav />
        <div className="flex flex-1 min-h-0 overflow-hidden">
          <AppSidebar>
            <BaseSidebar />
          </AppSidebar>
          <main className="flex-1 min-w-0 flex flex-col overflow-hidden">
            <TableView />
          </main>
        </div>
      </div>
    </AppProvider>
  )
}
```

- [ ] **Step 2: Update `app/page.tsx`**

```typescript
import { AppShell } from "@/components/app/AppShell"

export default function Page() {
  return <AppShell />
}
```

- [ ] **Step 3: Verify**

Open `http://localhost:3000`. You should see:
- Top nav with "Workstation" label and a space selector dropdown
- Left sidebar (resizable) showing bases for the active space
- If no space exists yet, the space dropdown will be empty — create one via the dropdown
- Clicking a table in the sidebar loads it in the main area with view tabs and the dynamic grid
- Clicking a cell in the grid allows inline editing
- Right-clicking a row shows "Expand record" and "Delete record"
- Expanding a record opens the right-side modal with all fields

- [ ] **Step 4: Seed Etsy template to verify**

```bash
# In browser console or via curl after creating a space:
curl -s -X POST http://localhost:3000/api/seed/etsy \
  -H "Content-Type: application/json" \
  -d '{"spaceId":"PASTE_SPACE_ID_HERE"}'
```

Expected: Etsy Store base appears in sidebar with Listings table, 13 fields, 3 views.
