"use client"

import { useState } from "react"
import { DndContext, DragOverlay, PointerSensor, useSensor, useSensors, useDroppable, useDraggable, type DragEndEvent, type DragStartEvent } from "@dnd-kit/core"
import type { AppRecord, CellValue, Field, SelectOption } from "@/types/core"
import { cn } from "@/lib/utils"

interface Props {
  fields: Field[]
  records: AppRecord[]
  groupFieldId?: string
  onRecordUpdate: (id: string, data: Record<string, CellValue>) => void
  onExpand: (record: AppRecord) => void
  onGroupFieldChange?: (fieldId: string) => void
}

export function DynamicKanban({ fields, records, groupFieldId, onRecordUpdate, onExpand, onGroupFieldChange }: Props) {
  const [activeId, setActiveId] = useState<string | null>(null)
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }))

  const groupField = fields.find((f) => f.id === groupFieldId) ?? fields.find((f) => f.type === "singleSelect")
  const primaryField = fields.find((f) => f.isPrimary) ?? fields[0]
  const secondaryFields = fields.filter((f) => !f.isPrimary && f.id !== groupField?.id && f.type !== "longText").slice(0, 2)
  const options: SelectOption[] = groupField?.config.options ?? []
  const activeRecord = records.find((r) => r.id === activeId)

  const selectFields = fields.filter((f) => f.type === "singleSelect")

  if (!groupField) {
    return (
      <div className="flex items-center justify-center h-full text-neutral-400 text-sm">
        Add a Single Select field to use Kanban view
      </div>
    )
  }

  if (records.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-neutral-400 gap-2">
        <p className="text-sm">No records yet</p>
        <p className="text-xs">Add records in the grid view first, then come back here to organize them</p>
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
      {selectFields.length > 1 && onGroupFieldChange && (
        <div className="flex items-center gap-2 px-4 pt-3 pb-0 shrink-0">
          <span className="text-xs text-neutral-400">Group by</span>
          <select
            value={groupField.id}
            onChange={(e) => onGroupFieldChange(e.target.value)}
            className="text-xs border rounded px-1.5 py-0.5 outline-none bg-white"
          >
            {selectFields.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}
          </select>
        </div>
      )}
      <div className="h-full flex gap-3 p-4 overflow-x-auto">
        {options.map((opt) => {
          const colRecords = records.filter((r) => r.data[groupField.id] === opt.id)
          return (
            <KanbanColumn key={opt.id} option={opt} records={colRecords} primaryField={primaryField}
              secondaryFields={secondaryFields} onExpand={onExpand} activeId={activeId} />
          )
        })}
        {(() => {
          const assignedIds = new Set(options.map((o) => o.id))
          const unassigned = records.filter((r) => !assignedIds.has(String(r.data[groupField.id] ?? "")))
          if (unassigned.length === 0) return null
          return (
            <KanbanColumn key="__unassigned" option={{ id: "__unassigned", label: "No status", color: "#a3a3a3" }}
              records={unassigned} primaryField={primaryField} secondaryFields={secondaryFields} onExpand={onExpand} activeId={activeId} />
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

function KanbanColumn({ option, records, primaryField, secondaryFields, onExpand, activeId }: {
  option: SelectOption; records: AppRecord[]; primaryField: Field | undefined
  secondaryFields: Field[]; onExpand: (r: AppRecord) => void; activeId: string | null
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
        {records.map((r) => <DraggableCard key={r.id} record={r} primaryField={primaryField} secondaryFields={secondaryFields} onExpand={onExpand} isDragging={activeId === r.id} />)}
      </div>
    </div>
  )
}

function DraggableCard({ record, primaryField, secondaryFields, onExpand, isDragging }: {
  record: AppRecord; primaryField: Field | undefined; secondaryFields: Field[]
  onExpand: (r: AppRecord) => void; isDragging: boolean
}) {
  const { attributes, listeners, setNodeRef, transform } = useDraggable({ id: record.id })
  const title = primaryField ? String(record.data[primaryField.id] ?? "") : ""
  return (
    <div ref={setNodeRef} {...listeners} {...attributes}
      style={transform ? { transform: `translate(${transform.x}px,${transform.y}px)` } : undefined}
      className={cn("touch-none", isDragging && "opacity-40")}
      onClick={() => onExpand(record)}
    >
      <div className="bg-white rounded-lg border p-2.5 cursor-pointer hover:shadow-sm hover:border-neutral-300 flex flex-col gap-1.5 transition-all">
        <p className="text-xs font-medium text-neutral-800 truncate">{title || "Untitled"}</p>
        {secondaryFields.map((f) => {
          const raw = record.data[f.id]
          if (raw == null || raw === "") return null
          const display = f.type === "singleSelect"
            ? (f.config.options?.find((o) => o.id === raw)?.label ?? String(raw))
            : String(raw)
          return (
            <p key={f.id} className="text-[10px] text-neutral-400 truncate">{display}</p>
          )
        })}
      </div>
    </div>
  )
}
