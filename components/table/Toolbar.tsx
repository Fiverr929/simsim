"use client"

import { useRef, useState } from "react"
import { useHotkeys } from "react-hotkeys-hook"
import { EyeOff, Search, AlignJustify, X, ArrowUpDown, Filter, Layers, Palette, Download, Upload } from "lucide-react"
import type { Field, Filter as FilterRule, Sort } from "@/types/core"
import { cn } from "@/lib/utils"

const ROW_HEIGHTS = [
  { label: "Short", value: 28 },
  { label: "Medium", value: 40 },
  { label: "Tall", value: 64 },
]

const OPERATORS = [
  { value: "contains", label: "contains" },
  { value: "doesNotContain", label: "doesn't contain" },
  { value: "is", label: "is" },
  { value: "isNot", label: "is not" },
  { value: "isEmpty", label: "is empty" },
  { value: "isNotEmpty", label: "is not empty" },
  { value: "gt", label: "greater than" },
  { value: "lt", label: "less than" },
]

const NO_VALUE_OPS = new Set(["isEmpty", "isNotEmpty"])

interface Props {
  fields: Field[]
  hiddenFieldIds: string[]
  rowHeight: number
  searchQuery: string
  sorts: Sort[]
  filters: FilterRule[]
  groupFieldId?: string
  colorFieldId?: string
  recordCount?: number
  onHiddenChange: (ids: string[]) => void
  onRowHeightChange: (h: number) => void
  onSearchChange: (q: string) => void
  onSortsChange: (sorts: Sort[]) => void
  onFiltersChange: (filters: FilterRule[]) => void
  onGroupFieldChange: (fieldId: string | undefined) => void
  onColorFieldChange: (fieldId: string | undefined) => void
  onExportCsv?: () => void
  onImportCsv?: () => void
}

export function Toolbar({
  fields, hiddenFieldIds, rowHeight, searchQuery, sorts, filters, groupFieldId, colorFieldId, recordCount,
  onHiddenChange, onRowHeightChange, onSearchChange, onSortsChange, onFiltersChange, onGroupFieldChange, onColorFieldChange,
  onExportCsv, onImportCsv,
}: Props) {
  const [openPanel, setOpenPanel] = useState<"hide" | "rowHeight" | "sort" | "filter" | "group" | "color" | null>(null)
  const selectFields = fields.filter((f) => f.type === "singleSelect")
  const [searchOpen, setSearchOpen] = useState(false)
  const searchRef = useRef<HTMLInputElement>(null)
  const hiddenCount = hiddenFieldIds.length
  const toggle = (p: typeof openPanel) => setOpenPanel(openPanel === p ? null : p)

  useHotkeys("mod+f", (e) => {
    e.preventDefault()
    setSearchOpen(true)
    setTimeout(() => searchRef.current?.focus(), 0)
  })

  const toggleField = (id: string) => {
    onHiddenChange(
      hiddenFieldIds.includes(id)
        ? hiddenFieldIds.filter((f) => f !== id)
        : [...hiddenFieldIds, id]
    )
  }

  const addSort = () => {
    const field = fields.find((f) => !sorts.some((s) => s.fieldId === f.id))
    if (!field) return
    onSortsChange([...sorts, { fieldId: field.id, direction: "asc" }])
  }

  const updateSort = (i: number, patch: Partial<Sort>) => {
    const next = sorts.map((s, idx) => idx === i ? { ...s, ...patch } : s)
    onSortsChange(next)
  }

  const removeSort = (i: number) => onSortsChange(sorts.filter((_, idx) => idx !== i))

  const addFilter = () => {
    const field = fields[0]
    if (!field) return
    onFiltersChange([...filters, { fieldId: field.id, operator: "contains", value: "" }])
  }

  const updateFilter = (i: number, patch: Partial<FilterRule>) => {
    const next = filters.map((f, idx) => idx === i ? { ...f, ...patch } : f)
    onFiltersChange(next)
  }

  const removeFilter = (i: number) => onFiltersChange(filters.filter((_, idx) => idx !== i))

  return (
    <div className="flex items-center gap-1 px-3 py-1.5 border-b bg-white shrink-0 flex-wrap">
      {/* Hide fields */}
      <div className="relative">
        <button
          onClick={() => toggle("hide")}
          className={cn(
            "flex items-center gap-1.5 px-2.5 py-1 text-xs rounded transition-colors",
            hiddenCount > 0 ? "text-blue-600 bg-blue-50 hover:bg-blue-100" : "text-neutral-600 hover:bg-neutral-100"
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

      {/* Sort */}
      <div className="relative">
        <button
          onClick={() => toggle("sort")}
          className={cn(
            "flex items-center gap-1.5 px-2.5 py-1 text-xs rounded transition-colors",
            sorts.length > 0 ? "text-blue-600 bg-blue-50 hover:bg-blue-100" : "text-neutral-600 hover:bg-neutral-100"
          )}
        >
          <ArrowUpDown size={13} />
          Sort{sorts.length > 0 ? ` (${sorts.length})` : ""}
        </button>

        {openPanel === "sort" && (
          <>
            <div className="fixed inset-0 z-40" onClick={() => setOpenPanel(null)} />
            <div className="absolute left-0 top-full mt-1 z-50 w-72 rounded-lg border bg-white shadow-lg p-3">
              <p className="text-xs font-semibold text-neutral-700 mb-2">Sort by</p>
              <div className="space-y-1.5">
                {sorts.map((s, i) => (
                  <div key={i} className="flex items-center gap-1.5">
                    <select
                      value={s.fieldId}
                      onChange={(e) => updateSort(i, { fieldId: e.target.value })}
                      className="flex-1 text-xs border rounded px-1.5 py-1 outline-none"
                    >
                      {fields.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}
                    </select>
                    <select
                      value={s.direction}
                      onChange={(e) => updateSort(i, { direction: e.target.value as "asc" | "desc" })}
                      className="text-xs border rounded px-1.5 py-1 outline-none"
                    >
                      <option value="asc">A → Z</option>
                      <option value="desc">Z → A</option>
                    </select>
                    <button onClick={() => removeSort(i)} className="text-neutral-400 hover:text-red-500">
                      <X size={12} />
                    </button>
                  </div>
                ))}
              </div>
              <button
                onClick={addSort}
                className="mt-2 flex items-center gap-1 text-xs text-blue-500 hover:text-blue-700"
              >
                + Add sort
              </button>
            </div>
          </>
        )}
      </div>

      {/* Filter */}
      <div className="relative">
        <button
          onClick={() => toggle("filter")}
          className={cn(
            "flex items-center gap-1.5 px-2.5 py-1 text-xs rounded transition-colors",
            filters.length > 0 ? "text-blue-600 bg-blue-50 hover:bg-blue-100" : "text-neutral-600 hover:bg-neutral-100"
          )}
        >
          <Filter size={13} />
          Filter{filters.length > 0 ? ` (${filters.length})` : ""}
        </button>

        {openPanel === "filter" && (
          <>
            <div className="fixed inset-0 z-40" onClick={() => setOpenPanel(null)} />
            <div className="absolute left-0 top-full mt-1 z-50 w-80 rounded-lg border bg-white shadow-lg p-3">
              <p className="text-xs font-semibold text-neutral-700 mb-2">Filter by</p>
              <div className="space-y-1.5">
                {filters.map((f, i) => (
                  <div key={i} className="flex items-center gap-1.5 flex-wrap">
                    <select
                      value={f.fieldId}
                      onChange={(e) => updateFilter(i, { fieldId: e.target.value })}
                      className="text-xs border rounded px-1.5 py-1 outline-none"
                    >
                      {fields.map((fld) => <option key={fld.id} value={fld.id}>{fld.name}</option>)}
                    </select>
                    <select
                      value={f.operator}
                      onChange={(e) => updateFilter(i, { operator: e.target.value as FilterRule["operator"] })}
                      className="text-xs border rounded px-1.5 py-1 outline-none"
                    >
                      {OPERATORS.map((op) => <option key={op.value} value={op.value}>{op.label}</option>)}
                    </select>
                    {!NO_VALUE_OPS.has(f.operator) && (
                      <input
                        className="flex-1 min-w-16 text-xs border rounded px-1.5 py-1 outline-none"
                        placeholder="value"
                        value={typeof f.value === "string" ? f.value : ""}
                        onChange={(e) => updateFilter(i, { value: e.target.value })}
                      />
                    )}
                    <button onClick={() => removeFilter(i)} className="text-neutral-400 hover:text-red-500">
                      <X size={12} />
                    </button>
                  </div>
                ))}
              </div>
              <button
                onClick={addFilter}
                className="mt-2 flex items-center gap-1 text-xs text-blue-500 hover:text-blue-700"
              >
                + Add filter
              </button>
            </div>
          </>
        )}
      </div>

      {/* Group */}
      <div className="relative">
        <button
          onClick={() => toggle("group")}
          className={cn(
            "flex items-center gap-1.5 px-2.5 py-1 text-xs rounded transition-colors",
            groupFieldId ? "text-blue-600 bg-blue-50 hover:bg-blue-100" : "text-neutral-600 hover:bg-neutral-100"
          )}
        >
          <Layers size={13} />
          Group{groupFieldId ? `: ${fields.find((f) => f.id === groupFieldId)?.name ?? ""}` : ""}
        </button>
        {openPanel === "group" && (
          <>
            <div className="fixed inset-0 z-40" onClick={() => setOpenPanel(null)} />
            <div className="absolute left-0 top-full mt-1 z-50 w-48 rounded-lg border bg-white shadow-lg py-1">
              <p className="px-3 py-1 text-[10px] font-semibold uppercase tracking-wider text-neutral-400">Group by</p>
              <button
                className={cn("w-full flex items-center px-3 py-1.5 text-xs hover:bg-neutral-50", !groupFieldId ? "text-blue-600 font-medium" : "text-neutral-600")}
                onClick={() => { onGroupFieldChange(undefined); setOpenPanel(null) }}
              >
                None
              </button>
              {fields.map((f) => (
                <button
                  key={f.id}
                  className={cn("w-full flex items-center px-3 py-1.5 text-xs hover:bg-neutral-50", f.id === groupFieldId ? "text-blue-600 font-medium" : "text-neutral-600")}
                  onClick={() => { onGroupFieldChange(f.id); setOpenPanel(null) }}
                >
                  {f.name}
                  {f.id === groupFieldId && <span className="ml-auto text-blue-400 text-[10px]">✓</span>}
                </button>
              ))}
            </div>
          </>
        )}
      </div>

      {/* Color */}
      <div className="relative">
        <button
          onClick={() => toggle("color")}
          className={cn(
            "flex items-center gap-1.5 px-2.5 py-1 text-xs rounded transition-colors",
            colorFieldId ? "text-blue-600 bg-blue-50 hover:bg-blue-100" : "text-neutral-600 hover:bg-neutral-100"
          )}
        >
          <Palette size={13} />
          Color{colorFieldId ? `: ${fields.find((f) => f.id === colorFieldId)?.name ?? ""}` : ""}
        </button>
        {openPanel === "color" && (
          <>
            <div className="fixed inset-0 z-40" onClick={() => setOpenPanel(null)} />
            <div className="absolute left-0 top-full mt-1 z-50 w-48 rounded-lg border bg-white shadow-lg py-1">
              <p className="px-3 py-1 text-[10px] font-semibold uppercase tracking-wider text-neutral-400">Color rows by</p>
              <button
                className={cn("w-full flex items-center px-3 py-1.5 text-xs hover:bg-neutral-50", !colorFieldId ? "text-blue-600 font-medium" : "text-neutral-600")}
                onClick={() => { onColorFieldChange(undefined); setOpenPanel(null) }}
              >
                None
              </button>
              {selectFields.length === 0 && (
                <p className="px-3 py-2 text-xs text-neutral-400">Add a Single Select field first</p>
              )}
              {selectFields.map((f) => (
                <button
                  key={f.id}
                  className={cn("w-full flex items-center px-3 py-1.5 text-xs hover:bg-neutral-50", f.id === colorFieldId ? "text-blue-600 font-medium" : "text-neutral-600")}
                  onClick={() => { onColorFieldChange(f.id); setOpenPanel(null) }}
                >
                  {f.name}
                  {f.id === colorFieldId && <span className="ml-auto text-blue-400 text-[10px]">✓</span>}
                </button>
              ))}
            </div>
          </>
        )}
      </div>

      {/* Row height */}
      <div className="relative">
        <button
          onClick={() => toggle("rowHeight")}
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

      {/* CSV */}
      {onExportCsv && (
        <button
          onClick={onExportCsv}
          className="flex items-center gap-1.5 px-2.5 py-1 text-xs text-neutral-600 rounded hover:bg-neutral-100"
          title="Export CSV"
        >
          <Download size={13} />
        </button>
      )}
      {onImportCsv && (
        <button
          onClick={onImportCsv}
          className="flex items-center gap-1.5 px-2.5 py-1 text-xs text-neutral-600 rounded hover:bg-neutral-100"
          title="Import CSV"
        >
          <Upload size={13} />
        </button>
      )}

      {/* Record count */}
      {recordCount !== undefined && (
        <span className="ml-auto text-[10px] text-neutral-400 mr-2 tabular-nums select-none">
          {recordCount} record{recordCount !== 1 ? "s" : ""}
        </span>
      )}

      {/* Search */}
      <div className="flex items-center">
        {searchOpen || searchQuery ? (
          <div className="flex items-center gap-1 border rounded px-2 py-1 bg-white shadow-sm">
            <Search size={12} className="text-neutral-400 shrink-0" />
            <input
              ref={searchRef}
              value={searchQuery}
              onChange={(e) => onSearchChange(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Escape") { onSearchChange(""); setSearchOpen(false) } }}
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
