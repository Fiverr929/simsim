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
import type { AppRecord, CellValue, Field, FieldConfig, FieldType } from "@/types/core"
import { formatNumber, formatDate } from "@/lib/utils"
import { Plus } from "lucide-react"
import { ConfirmDialog } from "@/components/ui/ConfirmDialog"

const GRID_THEME = {
  accentColor: "#3b82f6",
  accentLight: "#eff6ff",
  bgCell: "#ffffff",
  bgHeader: "#f8fafc",
  bgHeaderHasFocus: "#f1f5f9",
  bgHeaderHovered: "#f1f5f9",
  textHeader: "#475569",
  textDark: "#1e293b",
  textMedium: "#64748b",
  textLight: "#94a3b8",
  borderColor: "#e2e8f0",
  headerBottomBorderColor: "#cbd5e1",
  bgBubble: "#eff6ff",
  bgBubbleSelected: "#dbeafe",
  fontFamily: "var(--font-geist-sans, system-ui, sans-serif)",
  baseFontStyle: "13px",
  headerFontStyle: "12px 500",
  editorFontSize: "13px",
  lineHeight: 1.35,
  cellHorizontalPadding: 8,
  cellVerticalPadding: 4,
  drilldownBorder: "#bfdbfe",
  linkColor: "#3b82f6",
  bgSearchResult: "#fef9c3",
} as const

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
  colorFieldId?: string
  onRecordUpdate: (id: string, data: Record<string, CellValue>) => void
  onRecordAdd: () => void
  onRecordDelete: (id: string) => void
  onRecordsDelete?: (ids: string[]) => void
  onRecordsReorder?: (startIndex: number, endIndex: number) => void
  onRecordExpand: (record: AppRecord) => void
  onAddField: () => void
  onFieldRename: (id: string, name: string) => void
  onFieldTypeChange: (id: string, type: FieldType) => void
  onFieldDelete: (id: string) => void
  onFieldsDelete?: (ids: string[]) => void
  onFieldHide: (id: string) => void
  onFieldConfigUpdate?: (id: string, config: FieldConfig) => void
  fieldOrder?: string[]
  onFieldOrderChange?: (order: string[]) => void
  onSelectionChange?: (recordIds: string[]) => void
}

function cellForField(field: Field, value: CellValue): GridCell {
  switch (field.type) {
    case "number": {
      const num = typeof value === "number" ? value : value != null ? Number(value) : undefined
      return {
        kind: GridCellKind.Number,
        data: num,
        displayData: num != null && !isNaN(num) ? formatNumber(num, field.config) : "",
        allowOverlay: true,
      }
    }
    case "checkbox":
      return { kind: GridCellKind.Boolean, data: Boolean(value), allowOverlay: false }
    case "date": {
      const display = typeof value === "string" ? formatDate(value, field.config) : ""
      return { kind: GridCellKind.Text, data: display, displayData: display, allowOverlay: false }
    }
    case "url":
      return { kind: GridCellKind.Uri, data: typeof value === "string" ? value : "", allowOverlay: true }
    case "attachment": {
      const files = Array.isArray(value) ? value : []
      const display = files.length ? `${files.length} file${files.length > 1 ? "s" : ""}` : ""
      return { kind: GridCellKind.Text, data: display, displayData: display, allowOverlay: false }
    }
    case "singleSelect": {
      const opts = field.config.options ?? []
      const label = opts.find((o) => o.id === value)?.label ?? (typeof value === "string" ? value : "")
      return { kind: GridCellKind.Text, data: label, displayData: label, allowOverlay: false }
    }
    case "multiSelect": {
      const opts = field.config.options ?? []
      const ids = Array.isArray(value) ? value : []
      const display = ids.map((id) => opts.find((o) => o.id === id)?.label ?? id).join(", ")
      return { kind: GridCellKind.Text, data: display, displayData: display, allowOverlay: false }
    }
    default:
      return {
        kind: GridCellKind.Text,
        data: value != null ? String(value) : "",
        displayData: value != null ? String(value) : "",
        allowOverlay: true,
      }
  }
}

export function DynamicGrid({
  fields, records, hiddenFieldIds = [], rowHeight = 34, colorFieldId,
  onRecordUpdate, onRecordAdd, onRecordDelete, onRecordsDelete, onRecordsReorder, onRecordExpand, onAddField,
  onFieldRename, onFieldTypeChange, onFieldDelete, onFieldsDelete, onFieldHide, onFieldConfigUpdate,
  fieldOrder, onFieldOrderChange, onSelectionChange,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [dims, setDims] = useState({ width: 0, height: 0 })
  const [gridSelection, setGridSelection] = useState<GridSelection>(EMPTY_SELECTION)
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; recordId: string } | null>(null)
  const [confirmId, setConfirmId] = useState<string | null>(null)
  const [bulkFieldConfirm, setBulkFieldConfirm] = useState<string[] | null>(null)
  const [bulkRowConfirm, setBulkRowConfirm] = useState<string[] | null>(null)
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

  const visibleFields = useMemo(() => {
    const filtered = fields.filter((f) => !hiddenFieldIds.includes(f.id))
    if (!fieldOrder?.length) return filtered
    const index = new Map(fieldOrder.map((id, i) => [id, i]))
    return [...filtered].sort((a, b) => (index.get(a.id) ?? Infinity) - (index.get(b.id) ?? Infinity))
  }, [fields, hiddenFieldIds, fieldOrder])

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

  const onCellClicked = useCallback(
    ([col, row]: Item) => {
      const field = visibleFields[col]
      const record = records[row]
      if (!record || !field) return
      if (field.type === "checkbox") {
        onRecordUpdate(record.id, { [field.id]: !record.data[field.id] })
        return
      }
      if (field.type === "singleSelect" || field.type === "multiSelect" || field.type === "attachment") {
        onRecordExpand(record)
      }
    },
    [records, visibleFields, onRecordExpand, onRecordUpdate]
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

  const onColumnMoved = useCallback((startIndex: number, endIndex: number) => {
    const ids = visibleFields.map((f) => f.id)
    const [moved] = ids.splice(startIndex, 1)
    ids.splice(endIndex, 0, moved)
    onFieldOrderChange?.(ids)
  }, [visibleFields, onFieldOrderChange])

  const onRowMoved = useCallback((startIndex: number, endIndex: number) => {
    onRecordsReorder?.(startIndex, endIndex)
  }, [onRecordsReorder])

  const onDelete = useCallback((selection: GridSelection): false => {
    const colIndices = selection.columns.toArray()
    const rowIndices = selection.rows.toArray()

    const deletableFields = colIndices
      .map((i) => visibleFields[i]?.id)
      .filter((id: string | undefined): id is string => {
        if (!id) return false
        const f = fields.find((fld) => fld.id === id)
        return f ? !f.isPrimary : false
      })

    if (deletableFields.length > 0) setBulkFieldConfirm(deletableFields)

    if (rowIndices.length > 0 && onRecordsDelete) {
      const ids = rowIndices.map((i) => records[i]?.id).filter(Boolean) as string[]
      if (ids.length > 0) setBulkRowConfirm(ids)
    }

    return false
  }, [visibleFields, fields, records, onRecordsDelete])

  const colorField = colorFieldId ? fields.find((f) => f.id === colorFieldId) : undefined

  const getRowThemeOverride = useCallback((row: number) => {
    if (colorField) {
      const record = records[row]
      if (!record) return undefined
      const optionId = record.data[colorField.id]
      const option = colorField.config.options?.find((o) => o.id === optionId)
      if (option?.color) return { bgCell: option.color + "18", bgCellMedium: option.color + "28" }
    }
    if (row % 2 === 1) return { bgCell: "#fafbfc" }
    return undefined
  }, [colorField, records])

  return (
    <div ref={containerRef} className="relative flex-1 overflow-hidden">
      {dims.width > 0 && (
        <DataEditor
          theme={GRID_THEME}
          columns={columns}
          getCellContent={getCellContent}
          rows={records.length}
          width={dims.width}
          height={dims.height}
          rowMarkers="clickable-number"
          rowSelect="multi"
          columnSelect="multi"
          onCellEdited={onCellEdited}
          onCellClicked={onCellClicked}
          onCellContextMenu={onCellContextMenu}
          onHeaderContextMenu={onHeaderContextMenu}
          gridSelection={gridSelection}
          onGridSelectionChange={(sel) => {
            setGridSelection(sel)
            if (onSelectionChange) {
              const ids = sel.rows.toArray().map((i) => records[i]?.id).filter((id): id is string => Boolean(id))
              onSelectionChange(ids)
            }
          }}
          onDelete={onDelete}
          onColumnMoved={onColumnMoved}
          onRowMoved={onRowMoved}
          smoothScrollX
          smoothScrollY
          rowHeight={rowHeight}
          getRowThemeOverride={getRowThemeOverride}
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
          onConfigUpdate={onFieldConfigUpdate}
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
              onClick={() => { const r = records.find((r) => r.id === contextMenu.recordId); setContextMenu(null); if (r) onRecordExpand(r) }}
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
        <ConfirmDialog
          title="Delete record?"
          description="This cannot be undone."
          onConfirm={() => { onRecordDelete(confirmId); setConfirmId(null) }}
          onCancel={() => setConfirmId(null)}
        />
      )}

      {bulkFieldConfirm && (
        <ConfirmDialog
          title={`Delete ${bulkFieldConfirm.length} field${bulkFieldConfirm.length > 1 ? "s" : ""}?`}
          description="All data in these fields will be permanently lost. Primary fields are excluded from deletion."
          onConfirm={() => {
            onFieldsDelete?.(bulkFieldConfirm)
            setBulkFieldConfirm(null)
            setGridSelection(EMPTY_SELECTION)
          }}
          onCancel={() => setBulkFieldConfirm(null)}
        />
      )}

      {bulkRowConfirm && (
        <ConfirmDialog
          title={`Delete ${bulkRowConfirm.length} record${bulkRowConfirm.length > 1 ? "s" : ""}?`}
          description="This cannot be undone."
          onConfirm={() => {
            onRecordsDelete?.(bulkRowConfirm)
            setBulkRowConfirm(null)
            setGridSelection(EMPTY_SELECTION)
          }}
          onCancel={() => setBulkRowConfirm(null)}
        />
      )}
    </div>
  )
}
