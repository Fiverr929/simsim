"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { useHotkeys } from "react-hotkeys-hook"
import { Database, Table2, Search, X } from "lucide-react"
import { toast } from "sonner"
import Papa from "papaparse"
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
import { ListingSettingsPanel } from "@/components/listing-settings/ListingSettingsPanel"
import { AutomationToolbar } from "@/components/table/AutomationToolbar"
import type { AppRecord, CellValue, FieldConfig, FieldType, Filter, Sort, View, ViewConfig } from "@/types/core"

function detectDelimiter(text: string): string {
  const sample = text.slice(0, 1024 * 10) // first 10KB
  const candidates = [",", "\t", ";", "|"]
  let best = { delim: ",", score: 0 }
  for (const delim of candidates) {
    const counts: number[] = []
    for (const line of sample.split("\n")) {
      if (!line.trim()) continue
      const n = (line.match(new RegExp(delim === "\t" ? "\\t" : delim === "|" ? "\\|" : delim, "g")) ?? []).length
      if (n > 0) counts.push(n + 1) // fields = delimiters + 1
    }
    if (counts.length === 0) continue
    // Score: prefer consistent column count across lines, higher column count breaks ties
    const mode = counts.sort((a, b) => counts.filter((x) => x === a).length - counts.filter((x) => x === b).length).pop() ?? 0
    const consistent = counts.filter((c) => c === mode).length / counts.length
    const score = consistent * 100 + mode
    if (score > best.score) best = { delim, score }
  }
  return best.delim
}

function decodeFile(buffer: ArrayBuffer, encoding?: string): string {
  const bytes = new Uint8Array(buffer)
  // Detect encoding from BOM
  if (bytes.length >= 3 && bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf) {
    return new TextDecoder("utf-8").decode(bytes.slice(3))
  }
  if (bytes.length >= 2 && bytes[0] === 0xff && bytes[1] === 0xfe) {
    return new TextDecoder("utf-16le").decode(bytes.slice(2))
  }
  if (bytes.length >= 2 && bytes[0] === 0xfe && bytes[1] === 0xff) {
    return new TextDecoder("utf-16be").decode(bytes.slice(2))
  }
  if (encoding && encoding.toLowerCase() !== "utf-8" && encoding.toLowerCase() !== "ascii") {
    try { return new TextDecoder(encoding, { fatal: false }).decode(bytes) } catch { /* fall through */ }
  }
  return new TextDecoder("utf-8", { fatal: false }).decode(bytes)
}

function applyFilter(record: AppRecord, filter: Filter): boolean {
  const value = record.data[filter.fieldId]
  const fv = filter.value
  switch (filter.operator) {
    case "isEmpty": return value == null || value === "" || (Array.isArray(value) && value.length === 0)
    case "isNotEmpty": return !(value == null || value === "" || (Array.isArray(value) && value.length === 0))
    case "is": return String(value ?? "") === String(fv ?? "")
    case "isNot": return String(value ?? "") !== String(fv ?? "")
    case "contains": return String(value ?? "").toLowerCase().includes(String(fv ?? "").toLowerCase())
    case "doesNotContain": return !String(value ?? "").toLowerCase().includes(String(fv ?? "").toLowerCase())
    case "gt": return Number(value) > Number(fv)
    case "lt": return Number(value) < Number(fv)
    default: return true
  }
}

function compareValues(a: CellValue, b: CellValue): number {
  if (a == null && b == null) return 0
  if (a == null) return -1
  if (b == null) return 1
  if (typeof a === "number" && typeof b === "number") return a - b
  return String(a).localeCompare(String(b))
}

export function TableView() {
  const { activeTableId, activeViewId, setActiveViewId, activeSpaceId, setActiveSpaceId, setActiveBaseId, setActiveTableId, activeBaseId, activeBaseIntegration } = useApp()
  const { table, loading, addField, updateField, deleteField, deleteFields, refetch } = useTable(activeTableId)
  const { records, addRecord, updateRecord, deleteRecord, deleteRecords, patchLocalRecord } = useRecords(activeTableId)

  useHotkeys("mod+n", (e) => {
    e.preventDefault()
    if (activeTableId) addRecord()
  }, { enableOnFormTags: false }, [activeTableId, addRecord])

  useHotkeys("mod+shift+f", (e) => {
    e.preventDefault()
    if (activeTableId) setShowAddField(true)
  }, { enableOnFormTags: false }, [activeTableId])

  const [showSettings, setShowSettings] = useState(false)
  const [expandedRecord, setExpandedRecord] = useState<AppRecord | null>(null)
  const [showAddField, setShowAddField] = useState(false)
  const [views, setViews] = useState<View[]>([])
  const [searchQuery, setSearchQuery] = useState("")
  const [hiddenFieldIds, setHiddenFieldIds] = useState<string[]>([])
  const [rowHeight, setRowHeight] = useState(40)
  const [sorts, setSorts] = useState<Sort[]>([])
  const [filters, setFilters] = useState<Filter[]>([])
  const searchInputRef = useRef<HTMLInputElement>(null)
  const [selectedRecordIds, setSelectedRecordIds] = useState<string[]>([])
  const [automationRunning, setAutomationRunning] = useState(false)
  const [automationProgress, setAutomationProgress] = useState<{ done: number; total: number } | null>(null)
  const abortRef = useRef(false)
  const runningRef = useRef(false)

  useEffect(() => {
    setViews([])
    setSearchQuery("")
    setExpandedRecord(null)
  }, [activeTableId])

  useEffect(() => { setShowSettings(false) }, [activeTableId])

  useEffect(() => {
    setSelectedRecordIds([])
    setAutomationRunning(false)
    setAutomationProgress(null)
    abortRef.current = false
  }, [activeTableId])

  useEffect(() => {
    const handler = (e: Event) => {
      const { tableId } = (e as CustomEvent).detail
      if (tableId !== activeTableId) return
      addRecord()
    }
    window.addEventListener("etsy:new-listing", handler)
    return () => window.removeEventListener("etsy:new-listing", handler)
  }, [activeTableId, addRecord])

  useHotkeys("mod+f", (e) => {
    e.preventDefault()
    const vt = views.find((v) => v.id === activeViewId)?.type ?? "grid"
    if (vt === "grid") return
    setSearchQuery("")
    setTimeout(() => searchInputRef.current?.focus(), 0)
  }, { enableOnFormTags: false }, [activeViewId, views])

  useEffect(() => {
    if (!table) return
    setViews(table.views)
    const hasValidView = table.views.some((v) => v.id === activeViewId)
    if (!hasValidView) {
      setActiveViewId(table.views[0]?.id ?? null)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [table?.id])

  const activeView = views.find((v) => v.id === activeViewId) ?? views[0]

  useEffect(() => {
    if (!activeView) return
    setHiddenFieldIds(activeView.config.hiddenFields ?? [])
    setRowHeight(activeView.config.rowHeight ?? 40)
    setSorts(activeView.config.sorts ?? [])
    setFilters(activeView.config.filters ?? [])
  }, [activeView?.id])

  const saveViewConfig = useCallback(async (patch: Partial<ViewConfig>) => {
    if (!activeView) return
    const prevConfig = activeView.config
    const newConfig = { ...prevConfig, ...patch }
    setViews((prev) => prev.map((v) => v.id === activeView.id ? { ...v, config: newConfig } : v))
    const res = await fetch(`/api/views/${activeView.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ config: newConfig }),
    })
    if (!res.ok) {
      setViews((prev) => prev.map((v) => v.id === activeView.id ? { ...v, config: prevConfig } : v))
    }
  }, [activeView])

  const handleHiddenChange = (ids: string[]) => {
    setHiddenFieldIds(ids)
    saveViewConfig({ hiddenFields: ids })
  }

  const handleRowHeightChange = (h: number) => {
    setRowHeight(h)
    saveViewConfig({ rowHeight: h })
  }

  const handleSortsChange = (next: Sort[]) => {
    setSorts(next)
    saveViewConfig({ sorts: next })
  }

  const handleFiltersChange = (next: Filter[]) => {
    setFilters(next)
    saveViewConfig({ filters: next })
  }

  const handleFieldConfigUpdate = useCallback(async (fieldId: string, config: FieldConfig) => {
    await updateField(fieldId, { config })
  }, [updateField])

  const fields = table?.fields ?? []

  const runAutomation = useCallback(async (recordIds: string[]) => {
    if (!activeBaseId || runningRef.current) return

    let batchSize = 10
    try {
      const res = await fetch(`/api/listing-settings/${activeBaseId}`)
      if (res.ok) {
        const s = await res.json()
        batchSize = s.batchSize ?? 10
      } else {
        console.warn(`Failed to fetch listing settings: ${res.status}`)
      }
    } catch { console.warn("Failed to fetch batchSize, using default") }

    const batch = recordIds.slice(0, batchSize)
    const automationStateField = fields.find((f) => f.name === "Automation State")

    setAutomationRunning(true)
    abortRef.current = false
    runningRef.current = true
    setAutomationProgress({ done: 0, total: batch.length })

    if (automationStateField) {
      for (const id of batch) {
        patchLocalRecord(id, { [automationStateField.id]: "queued" })
      }
    }

    let done = 0
    for (const recordId of batch) {
      if (abortRef.current) break

      if (automationStateField) {
        patchLocalRecord(recordId, { [automationStateField.id]: "generating" })
        await updateRecord(recordId, { [automationStateField.id]: "generating" })
      }

      try {
        const res = await fetch("/api/automation/run-row", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ recordId, baseId: activeBaseId }),
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
      setAutomationProgress({ done, total: batch.length })
    }

    setAutomationRunning(false)
    setAutomationProgress(null)
    runningRef.current = false
  }, [activeBaseId, fields, patchLocalRecord, updateRecord])

  const retryErrors = useCallback(() => {
    const automationStateField = fields.find((f) => f.name === "Automation State")
    if (!automationStateField) return
    const errorIds = records
      .filter((r) => r.data[automationStateField.id] === "error")
      .map((r) => r.id)
    if (errorIds.length > 0) runAutomation(errorIds)
  }, [fields, records, runAutomation])
  const viewType = activeView?.type ?? "grid"

  const displayRecords = useMemo(() => {
    let result = records
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase()
      result = result.filter((r) => Object.values(r.data).some((v) => v != null && String(v).toLowerCase().includes(q)))
    }
    for (const f of filters) {
      if (f.fieldId) result = result.filter((r) => applyFilter(r, f))
    }
    if (sorts.length) {
      result = [...result].sort((a, b) => {
        for (const s of sorts) {
          const cmp = compareValues(a.data[s.fieldId] ?? null, b.data[s.fieldId] ?? null)
          if (cmp !== 0) return s.direction === "asc" ? cmp : -cmp
        }
        return 0
      })
    }
    return result
  }, [records, searchQuery, filters, sorts])

  const handleExportCsv = useCallback(() => {
    const visibleFields = fields.filter((f) => !hiddenFieldIds.includes(f.id))
    const esc = (v: string) => `"${v.replace(/"/g, '""')}"`
    const header = visibleFields.map((f) => esc(f.name)).join(",")
    const rows = displayRecords.map((r) =>
      visibleFields.map((f) => {
        const v = r.data[f.id]
        const str = v != null ? String(v) : ""
        return esc(str)
      }).join(",")
    )
    const csv = [header, ...rows].join("\r\n")
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url; a.download = `${table?.name ?? "export"}.csv`; a.click()
    URL.revokeObjectURL(url)
  }, [fields, hiddenFieldIds, displayRecords, table?.name])

  const importRef = useRef<HTMLInputElement>(null)
  const handleImportCsv = useCallback(() => importRef.current?.click(), [])

  const handleFileChange = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    // Read as ArrayBuffer for encoding detection, fall back to .text() if needed
    let text: string
    try {
      const buffer = await file.arrayBuffer()
      text = decodeFile(buffer)
    } catch {
      text = await file.text()
    }

    // Strip BOM if still present after decode
    if (text.charCodeAt(0) === 0xfeff) text = text.slice(1)

    // Auto-detect delimiter
    const delimiter = detectDelimiter(text)

    // Parse with PapaParse
    const result = Papa.parse<string[]>(text, {
      delimiter,
      skipEmptyLines: true,
      transform: (v) => v.trim(),
    })

    if (result.errors.length > 0) {
      const fatal = result.errors.filter((e) => e.type === "FieldMismatch" || e.type === "Quotes")
      if (fatal.length > 0) {
        toast.error(`CSV parse error: ${fatal[0].message}`)
        if (e.target) e.target.value = ""
        return
      }
    }

    const rows = result.data
    if (rows.length < 2) {
      toast.error("File is empty or has no data rows")
      if (e.target) e.target.value = ""
      return
    }

    const headers = rows[0]
    const dataRows = rows.slice(1)

    // Match existing fields, collect unmatched for auto-creation
    const currentFields = table?.fields ?? fields
    const fieldMap: Record<number, string> = {}
    const newFieldNames: string[] = []
    for (let j = 0; j < headers.length; j++) {
      const h = headers[j]
      if (!h) continue
      const hl = h.toLowerCase().trim()
      const match = currentFields.find((f) => f.name.toLowerCase().trim() === hl) ?? currentFields.find((f) => f.name === h)
      if (match) fieldMap[j] = match.id
      else newFieldNames.push(h)
    }

    // Auto-create missing fields
    if (newFieldNames.length > 0) {
      const res = await fetch("/api/fields/batch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tableId: activeTableId, fields: newFieldNames.map((n) => ({ name: n, type: "text" })) }),
      })
      if (res.ok) {
        const created: { id: string; name: string }[] = await res.json()
        for (const f of created) {
          const idx = headers.findIndex((h) => h.trim() === f.name.trim())
          if (idx >= 0 && !fieldMap[idx]) fieldMap[idx] = f.id
        }
        await refetch()
      }
    }

    const mapped = Object.keys(fieldMap).length
    let created = 0
    for (const row of dataRows) {
      if (row.every((v) => !v)) continue
      const data: Record<string, CellValue> = {}
      for (let j = 0; j < headers.length; j++) {
        if (fieldMap[j] && row[j]) data[fieldMap[j]] = row[j] || null
      }
      if (Object.keys(data).length > 0) {
        await addRecord(data)
        created++
      }
    }
    if (e.target) e.target.value = ""
    const delimInfo = delimiter !== "," ? ` (${delimiter === "\t" ? "tab" : delimiter} delimited)` : ""
    const newInfo = newFieldNames.length ? ` — ${newFieldNames.length} new field${newFieldNames.length !== 1 ? "s" : ""} created` : ""
    toast.success(`Imported ${created} record${created !== 1 ? "s" : ""} — ${mapped} field${mapped !== 1 ? "s" : ""} mapped${newInfo}${delimInfo}`)
  }, [fields, table?.fields, addRecord, refetch, activeTableId])

  if (!activeSpaceId) {
    return (
      <WelcomeState
        setActiveSpaceId={setActiveSpaceId}
        setActiveBaseId={setActiveBaseId}
        setActiveTableId={setActiveTableId}
        setActiveViewId={setActiveViewId}
      />
    )
  }

  if (!activeTableId) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center gap-4 text-center p-8">
        <div className="w-16 h-16 rounded-2xl bg-neutral-100 flex items-center justify-center text-2xl select-none">
          <Table2 size={28} className="text-neutral-300" />
        </div>
        <div className="space-y-1">
          <p className="text-sm font-medium text-neutral-600">No table selected</p>
          <p className="text-xs text-neutral-400">Select a table from the sidebar or create a new one</p>
        </div>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
        <div className="flex items-center gap-0.5 px-3 border-b bg-white shrink-0 h-9" />
        <div className="flex-1 p-4 space-y-1.5 overflow-hidden">
          {Array.from({ length: 20 }).map((_, i) => (
            <div key={i} className="h-8 rounded bg-neutral-100 animate-pulse" style={{ width: `${85 + Math.random() * 15}%` }} />
          ))}
        </div>
      </div>
    )
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
        onViewRenamed={(id, name) => {
          setViews((prev) => prev.map((v) => v.id === id ? { ...v, name } : v))
          fetch(`/api/views/${id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ name }),
          })
        }}
        onViewDeleted={(id) => {
          const next = views.filter((v) => v.id !== id)
          setViews(next)
          if (activeViewId === id) setActiveViewId(next[0]?.id ?? null)
          fetch(`/api/views/${id}`, { method: "DELETE" })
        }}
        onViewsReordered={(reordered) => setViews(reordered)}
        onSettingsClick={activeBaseIntegration === "etsy" ? () => setShowSettings((v) => !v) : undefined}
        settingsOpen={showSettings}
      />

      {viewType === "grid" && (
        <Toolbar
          fields={fields}
          hiddenFieldIds={hiddenFieldIds}
          rowHeight={rowHeight}
          searchQuery={searchQuery}
          sorts={sorts}
          filters={filters}
          groupFieldId={activeView?.config.groupFieldId}
          colorFieldId={activeView?.config.colorFieldId}
          recordCount={displayRecords.length}
          onHiddenChange={handleHiddenChange}
          onRowHeightChange={handleRowHeightChange}
          onSearchChange={setSearchQuery}
          onSortsChange={handleSortsChange}
          onFiltersChange={handleFiltersChange}
          onGroupFieldChange={(id) => saveViewConfig({ groupFieldId: id })}
          onColorFieldChange={(id) => saveViewConfig({ colorFieldId: id })}
          onExportCsv={handleExportCsv}
          onImportCsv={handleImportCsv}
        />
      )}

      {viewType !== "grid" && searchQuery && (
        <div className="flex items-center gap-2 px-3 py-1.5 border-b bg-white shrink-0">
          <Search size={12} className="text-neutral-400 shrink-0" />
          <input
            ref={searchInputRef}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Escape") setSearchQuery("") }}
            placeholder="Search records…"
            className="flex-1 text-xs outline-none bg-transparent"
          />
          <button
            onClick={() => setSearchQuery("")}
            className="text-neutral-400 hover:text-neutral-600 shrink-0"
          >
            <X size={12} />
          </button>
          <span className="text-[10px] text-neutral-400 tabular-nums">{displayRecords.length} result{displayRecords.length !== 1 ? "s" : ""}</span>
        </div>
      )}

      <div className="flex-1 flex flex-col min-h-0 overflow-hidden relative">
        {showSettings && activeBaseId ? (
          <ListingSettingsPanel
            baseId={activeBaseId}
            fields={fields}
            onClose={() => setShowSettings(false)}
          />
        ) : (
          <>
            {activeBaseIntegration === "etsy" && (
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
            )}
            {expandedRecord && (
              <RecordModal
                key={expandedRecord.id}
                record={expandedRecord}
                fields={fields}
                integration={activeBaseIntegration ?? undefined}
                onUpdate={updateRecord}
                onDelete={deleteRecord}
                onClose={() => setExpandedRecord(null)}
              />
            )}
            {viewType !== "grid" && (
              <button
                onClick={() => addRecord()}
                className="absolute bottom-5 right-5 z-10 flex items-center gap-1.5 px-3 py-2 bg-blue-500 text-white text-xs font-medium rounded-lg shadow-lg hover:bg-blue-600"
              >
                + Add record
              </button>
            )}
            {viewType === "grid" && (
              <DynamicGrid
                fields={fields}
                records={displayRecords}
                hiddenFieldIds={hiddenFieldIds}
                rowHeight={rowHeight}
                colorFieldId={activeView?.config.colorFieldId}
                onRecordUpdate={updateRecord}
                onRecordAdd={addRecord}
                onRecordDelete={deleteRecord}
                onRecordsDelete={deleteRecords}
                onRecordsReorder={(start, end) => {
                  const ids = displayRecords.map((r) => r.id)
                  const [moved] = ids.splice(start, 1)
                  ids.splice(end, 0, moved)
                  fetch("/api/records/reorder", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ items: ids.map((id, i) => ({ id, order: i })) }),
                  })
                }}
                onRecordExpand={setExpandedRecord}
                onAddField={() => setShowAddField(true)}
                onFieldRename={(id, name) => updateField(id, { name })}
                onFieldTypeChange={(id, type: FieldType) => updateField(id, { type })}
                onFieldDelete={deleteField}
                onFieldsDelete={deleteFields}
                onFieldHide={(id) => handleHiddenChange([...hiddenFieldIds, id])}
                onFieldConfigUpdate={handleFieldConfigUpdate}
                fieldOrder={activeView?.config.fieldOrder}
                onFieldOrderChange={(order) => saveViewConfig({ fieldOrder: order })}
                onSelectionChange={activeBaseIntegration === "etsy" ? setSelectedRecordIds : undefined}
              />
            )}
            {viewType === "gallery" && (
              <DynamicGallery
                fields={fields}
                records={displayRecords}
                coverFieldId={activeView?.config.coverFieldId}
                onExpand={setExpandedRecord}
                onContextMenu={(record) => setExpandedRecord(record)}
                onCoverFieldChange={(id) => saveViewConfig({ coverFieldId: id })}
              />
            )}
            {viewType === "kanban" && (
              <DynamicKanban
                fields={fields}
                records={displayRecords}
                groupFieldId={activeView?.config.groupFieldId}
                onRecordUpdate={updateRecord}
                onExpand={setExpandedRecord}
                onGroupFieldChange={(fieldId) => saveViewConfig({ groupFieldId: fieldId })}
              />
            )}
          </>
        )}
      </div>

      {showAddField && (
        <AddFieldModal
          onAdd={addField}
          onClose={() => setShowAddField(false)}
        />
      )}

      <input ref={importRef} type="file" accept=".csv,.txt,text/csv,text/plain" className="hidden" onChange={handleFileChange} />
    </div>
  )
}

function WelcomeState({
  setActiveSpaceId, setActiveBaseId, setActiveTableId, setActiveViewId,
}: {
  setActiveSpaceId: (id: string | null) => void
  setActiveBaseId: (id: string | null) => void
  setActiveTableId: (id: string | null) => void
  setActiveViewId: (id: string | null) => void
}) {
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
    setActiveBaseId(space.defaultBaseId ?? null)
    setActiveTableId(space.defaultTableId ?? null)
    setActiveViewId(space.defaultViewId ?? null)
    setCreating(false)
  }

  return (
    <div className="flex-1 flex flex-col items-center justify-center gap-5 text-center p-8">
      <Database size={44} className="text-neutral-300" />
      <div>
        <p className="text-base font-semibold text-neutral-800">Welcome</p>
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
