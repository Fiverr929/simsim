# UI Polish, Field Management & Space Settings — Plan 3

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the app usable end-to-end — space deletion, table rename, a field management menu on column headers, a toolbar with hide/search/row-height, and a proper first-run empty state.

**Architecture:** All field mutations flow through `useTable` which refetches after each write (no `window.location.reload()`). A `Toolbar` component manages view-level config (hidden fields, row height, search) persisted to the view's `config` JSON via PATCH `/api/views/[id]`. `DynamicGrid` gains glide's `onHeaderContextMenu` callback to show a `FieldHeaderMenu` portal. `TopNav` gains per-space delete. `BaseSidebar` gains table rename via double-click.

**Tech Stack:** Next.js 16, React 19, glide-data-grid 6.0.3, Tailwind CSS, lucide-react, Prisma.

---

## File Map

**Modify:**
- `hooks/useTable.ts` — add `addField`, `updateField`, `deleteField` mutations that call API + refetch
- `components/app/TopNav.tsx` — add per-space delete + MoreHorizontal context menu
- `components/app/BaseSidebar.tsx` — add table rename via double-click
- `components/table/DynamicGrid.tsx` — add `onHeaderContextMenu`, new field mutation props, render `FieldHeaderMenu`
- `components/table/TableView.tsx` — wire toolbar, add field modal, search filtering, view config persistence, WelcomeState

**Create:**
- `components/table/AddFieldModal.tsx` — type picker + name input dialog
- `components/table/FieldHeaderMenu.tsx` — floating header context menu (rename/type/hide/delete)
- `components/table/Toolbar.tsx` — hide fields panel, row height picker, search input

---

## Task 1: Extend useTable with field mutations

**Files:**
- Modify: `hooks/useTable.ts`

- [ ] **Step 1: Rewrite `hooks/useTable.ts`**

```typescript
import { useCallback, useEffect, useState } from "react"
import type { AppTable, FieldType } from "@/types/core"

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

  const refetch = useCallback(() => {
    if (tableId) fetchTable(tableId)
  }, [tableId, fetchTable])

  const addField = useCallback(async (name: string, type: FieldType) => {
    if (!tableId) return
    await fetch("/api/fields", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tableId, name, type }),
    })
    await fetchTable(tableId)
  }, [tableId, fetchTable])

  const updateField = useCallback(async (fieldId: string, data: { name?: string; type?: FieldType }) => {
    await fetch(`/api/fields/${fieldId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    })
    if (tableId) await fetchTable(tableId)
  }, [tableId, fetchTable])

  const deleteField = useCallback(async (fieldId: string) => {
    await fetch(`/api/fields/${fieldId}`, { method: "DELETE" })
    if (tableId) await fetchTable(tableId)
  }, [tableId, fetchTable])

  return { table, loading, refetch, addField, updateField, deleteField }
}
```

- [ ] **Step 2: Verify TypeScript**

Run: `npx tsc --noEmit 2>&1 | grep useTable`
Expected: no output (no errors)

---

## Task 2: AddFieldModal

**Files:**
- Create: `components/table/AddFieldModal.tsx`

- [ ] **Step 1: Create `components/table/AddFieldModal.tsx`**

```typescript
"use client"

import { useState } from "react"
import { X, Type, AlignLeft, Hash, ChevronDown, List, Calendar, CheckSquare, Paperclip, Link } from "lucide-react"
import type { FieldType } from "@/types/core"
import { cn } from "@/lib/utils"

const FIELD_TYPES: { type: FieldType; label: string; icon: React.ReactNode }[] = [
  { type: "text", label: "Text", icon: <Type size={15} /> },
  { type: "longText", label: "Long text", icon: <AlignLeft size={15} /> },
  { type: "number", label: "Number", icon: <Hash size={15} /> },
  { type: "singleSelect", label: "Single select", icon: <ChevronDown size={15} /> },
  { type: "multiSelect", label: "Multi select", icon: <List size={15} /> },
  { type: "date", label: "Date", icon: <Calendar size={15} /> },
  { type: "checkbox", label: "Checkbox", icon: <CheckSquare size={15} /> },
  { type: "url", label: "URL", icon: <Link size={15} /> },
  { type: "attachment", label: "Attachment", icon: <Paperclip size={15} /> },
]

interface Props {
  onAdd: (name: string, type: FieldType) => Promise<void>
  onClose: () => void
}

export function AddFieldModal({ onAdd, onClose }: Props) {
  const [name, setName] = useState("Field")
  const [type, setType] = useState<FieldType>("text")
  const [saving, setSaving] = useState(false)

  const submit = async () => {
    setSaving(true)
    await onAdd(name.trim() || "Field", type)
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/20" onClick={onClose} />
      <div className="relative bg-white rounded-xl shadow-xl border w-80 flex flex-col overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 border-b">
          <span className="text-sm font-semibold text-neutral-800">Add field</span>
          <button onClick={onClose} className="p-1 rounded hover:bg-neutral-100 text-neutral-400">
            <X size={15} />
          </button>
        </div>

        <div className="p-4 space-y-4">
          <div>
            <label className="block text-xs font-medium text-neutral-500 mb-1">Name</label>
            <input
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && submit()}
              className="w-full text-sm border rounded px-2.5 py-1.5 outline-none focus:border-blue-400"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-neutral-500 mb-2">Type</label>
            <div className="grid grid-cols-3 gap-1.5">
              {FIELD_TYPES.map((ft) => (
                <button
                  key={ft.type}
                  onClick={() => setType(ft.type)}
                  className={cn(
                    "flex flex-col items-center gap-1 p-2 rounded-lg border text-xs transition-colors",
                    type === ft.type
                      ? "border-blue-400 bg-blue-50 text-blue-600"
                      : "border-neutral-200 text-neutral-600 hover:bg-neutral-50"
                  )}
                >
                  {ft.icon}
                  <span className="text-[10px] leading-tight text-center">{ft.label}</span>
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-2 px-4 py-3 border-t bg-neutral-50">
          <button onClick={onClose} className="px-3 py-1.5 text-xs rounded border hover:bg-white">
            Cancel
          </button>
          <button
            onClick={submit}
            disabled={saving}
            className="px-3 py-1.5 text-xs rounded bg-blue-500 text-white hover:bg-blue-600 disabled:opacity-50"
          >
            {saving ? "Adding…" : "Add field"}
          </button>
        </div>
      </div>
    </div>
  )
}
```

---

## Task 3: FieldHeaderMenu

**Files:**
- Create: `components/table/FieldHeaderMenu.tsx`

- [ ] **Step 1: Create `components/table/FieldHeaderMenu.tsx`**

```typescript
"use client"

import { useEffect, useRef, useState } from "react"
import {
  Type, AlignLeft, Hash, ChevronDown, List, Calendar,
  CheckSquare, Paperclip, Link, Pencil, Trash2, EyeOff,
} from "lucide-react"
import type { Field, FieldType } from "@/types/core"
import { cn } from "@/lib/utils"

const TYPE_ICONS: Record<FieldType, React.ReactNode> = {
  text: <Type size={12} />,
  longText: <AlignLeft size={12} />,
  number: <Hash size={12} />,
  singleSelect: <ChevronDown size={12} />,
  multiSelect: <List size={12} />,
  date: <Calendar size={12} />,
  checkbox: <CheckSquare size={12} />,
  url: <Link size={12} />,
  attachment: <Paperclip size={12} />,
}

const FIELD_TYPE_LIST: { type: FieldType; label: string }[] = [
  { type: "text", label: "Text" },
  { type: "longText", label: "Long text" },
  { type: "number", label: "Number" },
  { type: "singleSelect", label: "Single select" },
  { type: "multiSelect", label: "Multi select" },
  { type: "date", label: "Date" },
  { type: "checkbox", label: "Checkbox" },
  { type: "url", label: "URL" },
  { type: "attachment", label: "Attachment" },
]

interface Props {
  field: Field
  x: number
  y: number
  onRename: (id: string, name: string) => void
  onTypeChange: (id: string, type: FieldType) => void
  onHide: (id: string) => void
  onDelete: (id: string) => void
  onClose: () => void
}

type View = "main" | "rename" | "type" | "confirmDelete"

export function FieldHeaderMenu({ field, x, y, onRename, onTypeChange, onHide, onDelete, onClose }: Props) {
  const [view, setView] = useState<View>("main")
  const [nameValue, setNameValue] = useState(field.name)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose()
    }
    document.addEventListener("mousedown", handler)
    return () => document.removeEventListener("mousedown", handler)
  }, [onClose])

  const left = Math.min(x, window.innerWidth - 210)
  const top = Math.min(y, window.innerHeight - 320)

  return (
    <>
      <div className="fixed inset-0 z-40" />
      <div
        ref={ref}
        className="fixed z-50 w-52 rounded-lg border bg-white shadow-lg py-1"
        style={{ left, top }}
      >
        {view === "main" && (
          <>
            <div className="px-3 py-2 border-b mb-1">
              <p className="text-xs font-semibold text-neutral-800 truncate">{field.name}</p>
              <p className="text-[10px] text-neutral-400 flex items-center gap-1 mt-0.5 capitalize">
                {TYPE_ICONS[field.type]} {field.type}
              </p>
            </div>
            <button
              className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-neutral-700 hover:bg-neutral-50"
              onClick={() => setView("rename")}
            >
              <Pencil size={12} /> Rename field
            </button>
            <button
              className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-neutral-700 hover:bg-neutral-50"
              onClick={() => setView("type")}
            >
              {TYPE_ICONS[field.type]} Change type
            </button>
            {!field.isPrimary && (
              <button
                className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-neutral-700 hover:bg-neutral-50"
                onClick={() => { onHide(field.id); onClose() }}
              >
                <EyeOff size={12} /> Hide field
              </button>
            )}
            {!field.isPrimary && (
              <>
                <div className="border-t my-1" />
                <button
                  className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-red-600 hover:bg-red-50"
                  onClick={() => setView("confirmDelete")}
                >
                  <Trash2 size={12} /> Delete field
                </button>
              </>
            )}
          </>
        )}

        {view === "rename" && (
          <div className="p-2.5">
            <p className="text-xs font-medium text-neutral-600 mb-1.5">Rename field</p>
            <input
              autoFocus
              value={nameValue}
              onChange={(e) => setNameValue(e.target.value)}
              className="w-full text-xs border rounded px-2 py-1.5 outline-none focus:border-blue-400 mb-2"
              onKeyDown={(e) => {
                if (e.key === "Enter") { onRename(field.id, nameValue.trim() || field.name); onClose() }
                if (e.key === "Escape") onClose()
              }}
            />
            <div className="flex gap-1.5">
              <button
                className="flex-1 text-xs border rounded py-1 hover:bg-neutral-50"
                onClick={onClose}
              >
                Cancel
              </button>
              <button
                className="flex-1 text-xs bg-blue-500 text-white rounded py-1 hover:bg-blue-600"
                onClick={() => { onRename(field.id, nameValue.trim() || field.name); onClose() }}
              >
                Save
              </button>
            </div>
          </div>
        )}

        {view === "type" && (
          <>
            <div className="px-3 py-1.5 border-b mb-1">
              <p className="text-xs font-medium text-neutral-600">Change type</p>
            </div>
            <div className="max-h-56 overflow-y-auto">
              {FIELD_TYPE_LIST.map((ft) => (
                <button
                  key={ft.type}
                  className={cn(
                    "w-full flex items-center gap-2 px-3 py-1.5 text-xs hover:bg-neutral-50",
                    ft.type === field.type ? "text-blue-600 font-medium" : "text-neutral-700"
                  )}
                  onClick={() => { onTypeChange(field.id, ft.type); onClose() }}
                >
                  {TYPE_ICONS[ft.type]} {ft.label}
                  {ft.type === field.type && <span className="ml-auto text-blue-500">✓</span>}
                </button>
              ))}
            </div>
          </>
        )}

        {view === "confirmDelete" && (
          <div className="p-3">
            <p className="text-xs font-semibold text-neutral-800 mb-1">Delete "{field.name}"?</p>
            <p className="text-[10px] text-neutral-500 mb-3">All data in this field will be lost permanently.</p>
            <div className="flex gap-1.5">
              <button
                className="flex-1 text-xs border rounded py-1 hover:bg-neutral-50"
                onClick={onClose}
              >
                Cancel
              </button>
              <button
                className="flex-1 text-xs bg-red-500 text-white rounded py-1 hover:bg-red-600"
                onClick={() => { onDelete(field.id); onClose() }}
              >
                Delete
              </button>
            </div>
          </div>
        )}
      </div>
    </>
  )
}
```

---

## Task 4: Update DynamicGrid with header context menu

**Files:**
- Modify: `components/table/DynamicGrid.tsx`

- [ ] **Step 1: Rewrite `components/table/DynamicGrid.tsx`**

Add `onHeaderContextMenu` handler using glide's `HeaderClickedEventArgs` (which has `bounds: {x,y,width,height}` and `localEventX`, `localEventY`). Add field mutation props. Render `FieldHeaderMenu` when `fieldMenu` is set.

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
  type HeaderClickedEventArgs,
} from "@glideapps/glide-data-grid"
import "@glideapps/glide-data-grid/dist/index.css"
import { FieldHeaderMenu } from "@/components/table/FieldHeaderMenu"
import type { AppRecord, CellValue, Field, FieldType } from "@/types/core"
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
  onFieldRename: (id: string, name: string) => void
  onFieldTypeChange: (id: string, type: FieldType) => void
  onFieldDelete: (id: string) => void
  onFieldHide: (id: string) => void
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

export function DynamicGrid({
  fields, records, hiddenFieldIds = [], rowHeight = 34,
  onRecordUpdate, onRecordAdd, onRecordDelete, onRecordExpand, onAddField,
  onFieldRename, onFieldTypeChange, onFieldDelete, onFieldHide,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [dims, setDims] = useState({ width: 0, height: 0 })
  const [gridSelection, setGridSelection] = useState<GridSelection>(EMPTY_SELECTION)
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; recordId: string } | null>(null)
  const [confirmId, setConfirmId] = useState<string | null>(null)
  const [fieldMenu, setFieldMenu] = useState<{ field: Field; x: number; y: number } | null>(null)

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
      else if (newValue.kind === GridCellKind.Boolean) value = newValue.data ?? null
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

  const onHeaderContextMenu = useCallback(
    (col: number, event: HeaderClickedEventArgs) => {
      event.preventDefault()
      const field = visibleFields[col]
      if (!field) return
      setFieldMenu({
        field,
        x: event.bounds.x + event.localEventX,
        y: event.bounds.y + event.localEventY,
      })
    },
    [visibleFields]
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
          onHeaderContextMenu={onHeaderContextMenu}
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

      {fieldMenu && (
        <FieldHeaderMenu
          field={fieldMenu.field}
          x={fieldMenu.x}
          y={fieldMenu.y}
          onRename={onFieldRename}
          onTypeChange={onFieldTypeChange}
          onHide={onFieldHide}
          onDelete={onFieldDelete}
          onClose={() => setFieldMenu(null)}
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

## Task 5: Toolbar

**Files:**
- Create: `components/table/Toolbar.tsx`

- [ ] **Step 1: Create `components/table/Toolbar.tsx`**

```typescript
"use client"

import { useState } from "react"
import { EyeOff, Search, AlignJustify, X } from "lucide-react"
import type { Field } from "@/types/core"
import { cn } from "@/lib/utils"

const ROW_HEIGHTS = [
  { label: "Short", value: 28 },
  { label: "Medium", value: 40 },
  { label: "Tall", value: 64 },
]

interface Props {
  fields: Field[]
  hiddenFieldIds: string[]
  rowHeight: number
  searchQuery: string
  onHiddenChange: (ids: string[]) => void
  onRowHeightChange: (h: number) => void
  onSearchChange: (q: string) => void
}

export function Toolbar({ fields, hiddenFieldIds, rowHeight, searchQuery, onHiddenChange, onRowHeightChange, onSearchChange }: Props) {
  const [openPanel, setOpenPanel] = useState<"hide" | "rowHeight" | null>(null)
  const [searchOpen, setSearchOpen] = useState(false)
  const hiddenCount = hiddenFieldIds.length

  const toggleField = (id: string) => {
    onHiddenChange(
      hiddenFieldIds.includes(id)
        ? hiddenFieldIds.filter((f) => f !== id)
        : [...hiddenFieldIds, id]
    )
  }

  return (
    <div className="flex items-center gap-1 px-3 py-1.5 border-b bg-white shrink-0">
      {/* Hide fields */}
      <div className="relative">
        <button
          onClick={() => setOpenPanel(openPanel === "hide" ? null : "hide")}
          className={cn(
            "flex items-center gap-1.5 px-2.5 py-1 text-xs rounded transition-colors",
            hiddenCount > 0
              ? "text-blue-600 bg-blue-50 hover:bg-blue-100"
              : "text-neutral-600 hover:bg-neutral-100"
          )}
        >
          <EyeOff size={13} />
          Hide{hiddenCount > 0 ? ` (${hiddenCount})` : ""}
        </button>

        {openPanel === "hide" && (
          <>
            <div className="fixed inset-0 z-40" onClick={() => setOpenPanel(null)} />
            <div className="absolute left-0 top-full mt-1 z-50 w-56 rounded-lg border bg-white shadow-lg p-3">
              <p className="text-xs font-semibold text-neutral-700 mb-2">Field visibility</p>
              <div className="space-y-0.5">
                {fields.map((f) => (
                  <label key={f.id} className="flex items-center gap-2 px-1.5 py-1 rounded hover:bg-neutral-50 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={!hiddenFieldIds.includes(f.id)}
                      onChange={() => { if (!f.isPrimary) toggleField(f.id) }}
                      disabled={f.isPrimary}
                      className="w-3.5 h-3.5 rounded border-neutral-300 accent-blue-500"
                    />
                    <span className={cn("text-xs flex-1 truncate", f.isPrimary ? "text-neutral-400" : "text-neutral-700")}>
                      {f.name}
                    </span>
                    {f.isPrimary && <span className="text-[9px] text-neutral-300">primary</span>}
                  </label>
                ))}
              </div>
              {hiddenCount > 0 && (
                <button
                  className="mt-2 w-full text-xs text-neutral-500 hover:text-neutral-700 py-1 border-t"
                  onClick={() => onHiddenChange([])}
                >
                  Show all fields
                </button>
              )}
            </div>
          </>
        )}
      </div>

      {/* Row height */}
      <div className="relative">
        <button
          onClick={() => setOpenPanel(openPanel === "rowHeight" ? null : "rowHeight")}
          className="flex items-center gap-1.5 px-2.5 py-1 text-xs text-neutral-600 rounded hover:bg-neutral-100"
        >
          <AlignJustify size={13} />
          Height
        </button>
        {openPanel === "rowHeight" && (
          <>
            <div className="fixed inset-0 z-40" onClick={() => setOpenPanel(null)} />
            <div className="absolute left-0 top-full mt-1 z-50 w-36 rounded-lg border bg-white shadow-lg py-1">
              {ROW_HEIGHTS.map((rh) => (
                <button
                  key={rh.value}
                  className={cn(
                    "w-full flex items-center justify-between px-3 py-1.5 text-xs hover:bg-neutral-50",
                    rowHeight === rh.value ? "text-blue-600 font-medium" : "text-neutral-700"
                  )}
                  onClick={() => { onRowHeightChange(rh.value); setOpenPanel(null) }}
                >
                  {rh.label}
                  {rowHeight === rh.value && <span className="text-blue-400 text-[10px]">✓</span>}
                </button>
              ))}
            </div>
          </>
        )}
      </div>

      {/* Search */}
      <div className="ml-auto flex items-center">
        {searchOpen || searchQuery ? (
          <div className="flex items-center gap-1 border rounded px-2 py-1 bg-white shadow-sm">
            <Search size={12} className="text-neutral-400 shrink-0" />
            <input
              autoFocus
              value={searchQuery}
              onChange={(e) => onSearchChange(e.target.value)}
              placeholder="Search records…"
              className="text-xs outline-none w-36 bg-transparent"
            />
            <button
              onClick={() => { onSearchChange(""); setSearchOpen(false) }}
              className="text-neutral-400 hover:text-neutral-600 shrink-0"
            >
              <X size={12} />
            </button>
          </div>
        ) : (
          <button
            onClick={() => setSearchOpen(true)}
            className="flex items-center gap-1.5 px-2.5 py-1 text-xs text-neutral-600 rounded hover:bg-neutral-100"
          >
            <Search size={13} /> Search
          </button>
        )}
      </div>
    </div>
  )
}
```

---

## Task 6: Space delete in TopNav

**Files:**
- Modify: `components/app/TopNav.tsx`

- [ ] **Step 1: Rewrite `components/app/TopNav.tsx`**

Add `spaceMenuId` state for the per-space context menu and `deleteSpace` handler.

```typescript
"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { ChevronDown, Plus, Check, MoreHorizontal, Pencil, Trash2 } from "lucide-react"
import { useApp } from "@/components/app/AppContext"
import type { Space } from "@/types/core"
import { cn } from "@/lib/utils"

export function TopNav() {
  const { activeSpaceId, setActiveSpaceId, setActiveBaseId, setActiveTableId, setActiveViewId } = useApp()
  const [spaces, setSpaces] = useState<Space[]>([])
  const [open, setOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [spaceMenuId, setSpaceMenuId] = useState<string | null>(null)
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
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false)
        setSpaceMenuId(null)
      }
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

  const deleteSpace = async (id: string) => {
    setSpaceMenuId(null)
    setOpen(false)
    const remaining = spaces.filter((s) => s.id !== id)
    setSpaces(remaining)
    if (activeSpaceId === id) {
      setActiveSpaceId(remaining[0]?.id ?? null)
      setActiveBaseId(null)
      setActiveTableId(null)
      setActiveViewId(null)
    }
    await fetch(`/api/spaces/${id}`, { method: "DELETE" })
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
          <div className="absolute left-0 top-full mt-1 z-50 w-60 rounded-lg border bg-white shadow-lg py-1">
            <p className="px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-neutral-400">Spaces</p>
            {spaces.map((s) => (
              <div key={s.id} className="relative group">
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
                  <div className="flex items-center">
                    <button
                      className="flex-1 flex items-center gap-2 px-3 py-1.5 text-sm text-neutral-700 hover:bg-neutral-50 text-left"
                      onClick={() => switchSpace(s.id)}
                    >
                      <span>{s.icon}</span>
                      <span className="flex-1 truncate">{s.name}</span>
                      {s.id === activeSpaceId && <Check size={13} className="text-blue-500 shrink-0" />}
                    </button>
                    <button
                      className="opacity-0 group-hover:opacity-100 px-2 py-1.5 text-neutral-400 hover:text-neutral-700 transition-opacity"
                      onClick={(e) => { e.stopPropagation(); setSpaceMenuId(spaceMenuId === s.id ? null : s.id) }}
                    >
                      <MoreHorizontal size={13} />
                    </button>
                  </div>
                )}

                {spaceMenuId === s.id && (
                  <>
                    <div className="fixed inset-0 z-[60]" onClick={() => setSpaceMenuId(null)} />
                    <div className="absolute right-0 top-full mt-0.5 z-[70] w-36 rounded-md border bg-white shadow-md py-1">
                      <button
                        className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-neutral-700 hover:bg-neutral-50"
                        onClick={() => { setSpaceMenuId(null); setEditingId(s.id) }}
                      >
                        <Pencil size={11} /> Rename
                      </button>
                      <button
                        className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-red-600 hover:bg-red-50"
                        onClick={() => deleteSpace(s.id)}
                      >
                        <Trash2 size={11} /> Delete space
                      </button>
                    </div>
                  </>
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

## Task 7: Table rename in BaseSidebar

**Files:**
- Modify: `components/app/BaseSidebar.tsx`

- [ ] **Step 1: Rewrite `components/app/BaseSidebar.tsx`**

Add `tableEditingId` and `tableEditName` state. Table names become editable on double-click (same pattern as base names).

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
  const [tableEditingId, setTableEditingId] = useState<string | null>(null)
  const [tableEditName, setTableEditName] = useState("")
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

  const renameTable = async (baseId: string, tableId: string, name: string) => {
    setTableEditingId(null)
    const trimmed = name.trim() || "Untitled"
    setBases((prev) =>
      prev.map((b) =>
        b.id === baseId
          ? { ...b, tables: b.tables.map((t) => t.id === tableId ? { ...t, name: trimmed } : t) }
          : b
      )
    )
    await fetch(`/api/tables/${tableId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: trimmed }),
    })
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

            {expanded.has(base.id) && (
              <div className="ml-5 space-y-0.5">
                {base.tables.map((table) => (
                  <div
                    key={table.id}
                    className="group flex items-center gap-1.5 rounded-md px-2 py-1 hover:bg-neutral-100 relative cursor-pointer"
                    onClick={() => { openTable(table.id); setActiveBaseId(base.id) }}
                  >
                    <Table2 size={12} className={cn("shrink-0", activeTableId === table.id ? "text-blue-500" : "text-neutral-400")} />
                    {tableEditingId === table.id ? (
                      <input
                        autoFocus
                        value={tableEditName}
                        onChange={(e) => setTableEditName(e.target.value)}
                        className="flex-1 text-xs outline-none bg-transparent"
                        onBlur={() => renameTable(base.id, table.id, tableEditName)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") renameTable(base.id, table.id, tableEditName)
                          if (e.key === "Escape") setTableEditingId(null)
                        }}
                        onClick={(e) => e.stopPropagation()}
                      />
                    ) : (
                      <span
                        className={cn("flex-1 text-xs truncate", activeTableId === table.id ? "text-blue-600 font-medium" : "text-neutral-600")}
                        onDoubleClick={(e) => {
                          e.stopPropagation()
                          setTableEditName(table.name)
                          setTableEditingId(table.id)
                        }}
                      >
                        {table.name}
                      </span>
                    )}
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

        {bases.length === 0 && (
          <div className="text-xs text-neutral-400 px-2 py-4 text-center">
            No bases yet — add one below
          </div>
        )}
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

## Task 8: Wire everything in TableView

**Files:**
- Modify: `components/table/TableView.tsx`

- [ ] **Step 1: Rewrite `components/table/TableView.tsx`**

Wire toolbar, add field modal, search filtering, view config persistence, and WelcomeState. Fix the `views` sync bug (was calling `setViews` during render).

```typescript
"use client"

import { useCallback, useEffect, useState } from "react"
import { useApp } from "@/components/app/AppContext"
import { useTable } from "@/hooks/useTable"
import { useRecords } from "@/hooks/useRecords"
import { ViewTabs } from "@/components/app/ViewTabs"
import { Toolbar } from "@/components/table/Toolbar"
import { DynamicGrid } from "@/components/table/DynamicGrid"
import { DynamicGallery } from "@/components/table/DynamicGallery"
import { DynamicKanban } from "@/components/table/DynamicKanban"
import { RecordModal } from "@/components/table/RecordModal"
import { AddFieldModal } from "@/components/table/AddFieldModal"
import type { AppRecord, FieldType, View, ViewConfig } from "@/types/core"

export function TableView() {
  const { activeTableId, activeViewId, setActiveViewId, activeSpaceId, setActiveSpaceId } = useApp()
  const { table, loading, addField, updateField, deleteField } = useTable(activeTableId)
  const { records, addRecord, updateRecord, deleteRecord } = useRecords(activeTableId)

  const [expandedRecord, setExpandedRecord] = useState<AppRecord | null>(null)
  const [showAddField, setShowAddField] = useState(false)
  const [views, setViews] = useState<View[]>([])
  const [searchQuery, setSearchQuery] = useState("")
  const [hiddenFieldIds, setHiddenFieldIds] = useState<string[]>([])
  const [rowHeight, setRowHeight] = useState(34)

  // Reset state when switching tables
  useEffect(() => {
    setViews([])
    setSearchQuery("")
    setExpandedRecord(null)
  }, [activeTableId])

  // Sync views when table loads
  useEffect(() => {
    if (!table) return
    setViews(table.views)
    // Reset to first view only if the current activeViewId doesn't belong to this table
    const hasValidView = table.views.some((v) => v.id === activeViewId)
    if (!hasValidView) {
      setActiveViewId(table.views[0]?.id ?? null)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [table?.id])

  const activeView = views.find((v) => v.id === activeViewId) ?? views[0]

  // Sync toolbar state from active view config
  useEffect(() => {
    if (!activeView) return
    setHiddenFieldIds(activeView.config.hiddenFields ?? [])
    setRowHeight(activeView.config.rowHeight ?? 34)
  }, [activeView?.id])

  const saveViewConfig = useCallback(async (patch: Partial<ViewConfig>) => {
    if (!activeView) return
    const newConfig = { ...activeView.config, ...patch }
    setViews((prev) => prev.map((v) => v.id === activeView.id ? { ...v, config: newConfig } : v))
    await fetch(`/api/views/${activeView.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ config: newConfig }),
    })
  }, [activeView])

  const handleHiddenChange = (ids: string[]) => {
    setHiddenFieldIds(ids)
    saveViewConfig({ hiddenFields: ids })
  }

  const handleRowHeightChange = (h: number) => {
    setRowHeight(h)
    saveViewConfig({ rowHeight: h })
  }

  const fields = table?.fields ?? []
  const viewType = activeView?.type ?? "grid"

  const filteredRecords = searchQuery.trim()
    ? records.filter((r) => {
        const q = searchQuery.toLowerCase()
        return Object.values(r.data).some((v) => v != null && String(v).toLowerCase().includes(q))
      })
    : records

  // First-run: no spaces at all
  if (!activeSpaceId) {
    return <WelcomeState setActiveSpaceId={setActiveSpaceId} />
  }

  // No table selected
  if (!activeTableId) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center gap-2 text-neutral-400">
        <p className="text-sm">Select a table from the sidebar</p>
        <p className="text-xs text-neutral-300">or create a new one</p>
      </div>
    )
  }

  if (loading) {
    return <div className="flex-1 flex items-center justify-center text-neutral-400 text-sm">Loading…</div>
  }

  if (!table) return null

  return (
    <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
      <ViewTabs
        views={views}
        onViewAdded={(v) => {
          setViews((prev) => [...prev, v])
          setActiveViewId(v.id)
        }}
      />

      {viewType === "grid" && (
        <Toolbar
          fields={fields}
          hiddenFieldIds={hiddenFieldIds}
          rowHeight={rowHeight}
          searchQuery={searchQuery}
          onHiddenChange={handleHiddenChange}
          onRowHeightChange={handleRowHeightChange}
          onSearchChange={setSearchQuery}
        />
      )}

      <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
        {viewType === "grid" && (
          <DynamicGrid
            fields={fields}
            records={filteredRecords}
            hiddenFieldIds={hiddenFieldIds}
            rowHeight={rowHeight}
            onRecordUpdate={updateRecord}
            onRecordAdd={addRecord}
            onRecordDelete={deleteRecord}
            onRecordExpand={setExpandedRecord}
            onAddField={() => setShowAddField(true)}
            onFieldRename={(id, name) => updateField(id, { name })}
            onFieldTypeChange={(id, type: FieldType) => updateField(id, { type })}
            onFieldDelete={deleteField}
            onFieldHide={(id) => handleHiddenChange([...hiddenFieldIds, id])}
          />
        )}
        {viewType === "gallery" && (
          <DynamicGallery
            fields={fields}
            records={filteredRecords}
            onExpand={setExpandedRecord}
            onContextMenu={(record) => setExpandedRecord(record)}
          />
        )}
        {viewType === "kanban" && (
          <DynamicKanban
            fields={fields}
            records={filteredRecords}
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

      {showAddField && (
        <AddFieldModal
          onAdd={addField}
          onClose={() => setShowAddField(false)}
        />
      )}
    </div>
  )
}

function WelcomeState({ setActiveSpaceId }: { setActiveSpaceId: (id: string | null) => void }) {
  const [creating, setCreating] = useState(false)

  const create = async () => {
    setCreating(true)
    const res = await fetch("/api/spaces", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "My Space" }),
    })
    const space = await res.json()
    setActiveSpaceId(space.id)
    setCreating(false)
  }

  return (
    <div className="flex-1 flex flex-col items-center justify-center gap-5 text-center p-8">
      <div className="text-5xl">🗄️</div>
      <div>
        <p className="text-base font-semibold text-neutral-800">Welcome to Workstation</p>
        <p className="text-sm text-neutral-400 mt-1 max-w-xs">
          A flexible database for your work — create a space to get started
        </p>
      </div>
      <button
        onClick={create}
        disabled={creating}
        className="px-5 py-2 bg-blue-500 text-white text-sm font-medium rounded-lg hover:bg-blue-600 disabled:opacity-50 shadow-sm"
      >
        {creating ? "Creating…" : "Create your first space"}
      </button>
    </div>
  )
}
```

- [ ] **Step 2: Verify TypeScript**

Run: `npx tsc --noEmit 2>&1 | grep -v "types/listing\|panel/\|grid/\|workstation/"`
Expected: no output

- [ ] **Step 3: Build check**

Run: `npx next build 2>&1 | tail -10`
Expected: `✓ Compiled successfully` with all API routes listed

- [ ] **Step 4: Smoke test**

Open `http://localhost:3000` and verify:
- First visit (no spaces): welcome card with 🗄️ and "Create your first space" button
- After creating space: sidebar shows "No bases yet"
- Create a base → tables tree appears
- Create a table → grid loads with "Name" field and toolbar visible
- Toolbar: Hide panel shows fields with checkboxes; Row height cycles Short/Medium/Tall; Search filters rows by typing
- Click "+ Field" button in grid header → AddFieldModal opens with 9 type options
- Right-click on a column header → FieldHeaderMenu appears with rename/type/hide/delete
- Rename field → updates column header without page reload
- Delete field → column disappears without page reload
- Space dropdown: hover a space → "..." appears → click it → Rename / Delete space options appear
- Delete space → space removed, sidebar clears
- Double-click table name in sidebar → inline rename input appears
