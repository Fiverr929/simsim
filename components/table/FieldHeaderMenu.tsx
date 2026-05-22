"use client"

import { useEffect, useRef, useState } from "react"
import { List, Pencil, Trash2, EyeOff, Plus, X, ChevronLeft } from "lucide-react"
import type { Field, FieldConfig, FieldType, SelectOption } from "@/types/core"
import { cn } from "@/lib/utils"
import { FIELD_TYPE_META } from "@/lib/field-types"

const TYPE_ICON_SMALL: Record<FieldType, React.ReactNode> = Object.fromEntries(
  FIELD_TYPE_META.map((ft) => [ft.type, ft.icon])
) as Record<FieldType, React.ReactNode>

const OPTION_COLORS = [
  "#ef4444", "#f97316", "#eab308", "#22c55e",
  "#3b82f6", "#8b5cf6", "#ec4899", "#6b7280",
]

const NUMBER_FORMATS = [
  { value: "decimal", label: "Decimal (1,234.56)" },
  { value: "integer", label: "Integer (1,234)" },
  { value: "currency", label: "Currency ($1,234.56)" },
  { value: "percent", label: "Percent (12.3%)" },
] as const

const DATE_FORMATS = [
  { value: "MMM d, yyyy", label: "Jan 15, 2026" },
  { value: "d MMM yyyy", label: "15 Jan 2026" },
  { value: "MM/dd/yyyy", label: "01/15/2026" },
  { value: "dd/MM/yyyy", label: "15/01/2026" },
  { value: "yyyy-MM-dd", label: "2026-01-15" },
] as const

type MenuView = "main" | "rename" | "type" | "confirmDelete" | "editOptions" | "editFormat"

interface Props {
  field: Field
  x: number
  y: number
  onRename: (id: string, name: string) => void
  onTypeChange: (id: string, type: FieldType) => void
  onHide: (id: string) => void
  onDelete: (id: string) => void
  onConfigUpdate?: (id: string, config: FieldConfig) => void
  onClose: () => void
}

export function FieldHeaderMenu({ field, x, y, onRename, onTypeChange, onHide, onDelete, onConfigUpdate, onClose }: Props) {
  const [view, setView] = useState<MenuView>("main")
  const [nameValue, setNameValue] = useState(field.name)
  const [options, setOptions] = useState<SelectOption[]>(field.config.options ?? [])
  const [newOptionLabel, setNewOptionLabel] = useState("")
  const [labelDrafts, setLabelDrafts] = useState<Record<string, string>>({})
  const ref = useRef<HTMLDivElement>(null)
  const debounceRef = useRef<Record<string, ReturnType<typeof setTimeout>>>({})

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose()
    }
    document.addEventListener("mousedown", handler)
    return () => document.removeEventListener("mousedown", handler)
  }, [onClose])

  const left = Math.min(x, window.innerWidth - 220)
  const top = Math.min(y, window.innerHeight - 380)

  const saveOptions = (next: SelectOption[]) => {
    setOptions(next)
    onConfigUpdate?.(field.id, { ...field.config, options: next })
  }

  const addOption = () => {
    const label = newOptionLabel.trim()
    if (!label) return
    const color = OPTION_COLORS[options.length % OPTION_COLORS.length]
    const next = [...options, { id: crypto.randomUUID(), label, color }]
    saveOptions(next)
    setNewOptionLabel("")
  }

  const deleteOption = (id: string) => saveOptions(options.filter((o) => o.id !== id))

  const handleLabelChange = (id: string, value: string) => {
    setLabelDrafts((prev) => ({ ...prev, [id]: value }))
    if (debounceRef.current[id]) clearTimeout(debounceRef.current[id])
    debounceRef.current[id] = setTimeout(() => {
      const trimmed = value.trim()
      if (!trimmed) return
      saveOptions(options.map((o) => o.id === id ? { ...o, label: trimmed } : o))
      setLabelDrafts((prev) => { const n = { ...prev }; delete n[id]; return n })
    }, 400)
  }

  const commitLabel = (id: string) => {
    const draft = labelDrafts[id]
    if (!draft || !draft.trim() || draft === options.find((o) => o.id === id)?.label) {
      setLabelDrafts((prev) => { const n = { ...prev }; delete n[id]; return n })
      return
    }
    if (debounceRef.current[id]) clearTimeout(debounceRef.current[id])
    saveOptions(options.map((o) => o.id === id ? { ...o, label: draft.trim() } : o))
    setLabelDrafts((prev) => { const n = { ...prev }; delete n[id]; return n })
  }

  const cycleColor = (id: string) =>
    saveOptions(options.map((o) => {
      if (o.id !== id) return o
      const idx = (OPTION_COLORS.indexOf(o.color) + 1) % OPTION_COLORS.length
      return { ...o, color: OPTION_COLORS[idx] }
    }))

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
                {TYPE_ICON_SMALL[field.type]} {field.type}
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
              {TYPE_ICON_SMALL[field.type]} Change type
            </button>
            {field.type === "number" && (
              <button
                className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-neutral-700 hover:bg-neutral-50"
                onClick={() => setView("editFormat")}
              >
                <List size={12} /> Format number
              </button>
            )}
            {field.type === "date" && (
              <button
                className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-neutral-700 hover:bg-neutral-50"
                onClick={() => setView("editFormat")}
              >
                <List size={12} /> Format date
              </button>
            )}
            {(field.type === "singleSelect" || field.type === "multiSelect") && (
              <button
                className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-neutral-700 hover:bg-neutral-50"
                onClick={() => setView("editOptions")}
              >
                <List size={12} /> Edit options
              </button>
            )}
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
              <button className="flex-1 text-xs border rounded py-1 hover:bg-neutral-50" onClick={onClose}>
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
            <div className="px-3 py-1.5 border-b mb-1 flex items-center gap-1.5">
              <button className="text-neutral-400 hover:text-neutral-600" onClick={() => setView("main")}><ChevronLeft size={13} /></button>
              <p className="text-xs font-medium text-neutral-600">Change type</p>
            </div>
            <div className="max-h-56 overflow-y-auto">
              {FIELD_TYPE_META.map((ft) => (
                <button
                  key={ft.type}
                  className={cn(
                    "w-full flex items-center gap-2 px-3 py-1.5 text-xs hover:bg-neutral-50",
                    ft.type === field.type ? "text-blue-600 font-medium" : "text-neutral-700"
                  )}
                  onClick={() => { onTypeChange(field.id, ft.type); onClose() }}
                >
                  {TYPE_ICON_SMALL[ft.type]} {ft.label}
                  {ft.type === field.type && <span className="ml-auto text-blue-400 text-[10px]">✓</span>}
                </button>
              ))}
            </div>
          </>
        )}

        {view === "editOptions" && (
          <>
            <div className="px-3 py-1.5 border-b mb-1 flex items-center gap-1.5">
              <button className="text-neutral-400 hover:text-neutral-600" onClick={() => setView("main")}><ChevronLeft size={13} /></button>
              <p className="text-xs font-medium text-neutral-600">Options</p>
            </div>
            <div className="max-h-48 overflow-y-auto px-2 space-y-0.5">
              {options.length === 0 && (
                <p className="text-xs text-neutral-400 py-2 text-center">No options yet</p>
              )}
              {options.map((opt) => (
                <div key={opt.id} className="flex items-center gap-1.5 group">
                  <button
                    className="w-3 h-3 rounded-full shrink-0 ring-1 ring-black/10"
                    style={{ background: opt.color }}
                    onClick={() => cycleColor(opt.id)}
                    title="Click to change color"
                  />
                  <input
                    className="flex-1 text-xs outline-none bg-transparent py-1 min-w-0"
                    value={labelDrafts[opt.id] ?? opt.label}
                    onChange={(e) => handleLabelChange(opt.id, e.target.value)}
                    onBlur={() => commitLabel(opt.id)}
                    onKeyDown={(e) => { if (e.key === "Enter") commitLabel(opt.id) }}
                  />
                  <button
                    className="opacity-0 group-hover:opacity-100 text-neutral-300 hover:text-red-500"
                    onClick={() => deleteOption(opt.id)}
                  >
                    <X size={10} />
                  </button>
                </div>
              ))}
            </div>
            <div className="px-2 pt-1.5 pb-1 border-t mt-1">
              <div className="flex items-center gap-1.5">
                <Plus size={11} className="text-neutral-400 shrink-0" />
                <input
                  className="flex-1 text-xs outline-none bg-transparent py-0.5"
                  placeholder="Add an option…"
                  value={newOptionLabel}
                  onChange={(e) => setNewOptionLabel(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") addOption() }}
                />
              </div>
            </div>
          </>
        )}

        {view === "editFormat" && (
          <>
            <div className="px-3 py-1.5 border-b mb-1 flex items-center gap-1.5">
              <button className="text-neutral-400 hover:text-neutral-600" onClick={() => setView("main")}><ChevronLeft size={13} /></button>
              <p className="text-xs font-medium text-neutral-600">Format {field.type === "number" ? "number" : "date"}</p>
            </div>
            <div className="max-h-56 overflow-y-auto">
              {field.type === "number" && NUMBER_FORMATS.map((f) => (
                <button
                  key={f.value}
                  className={`w-full flex items-center gap-2 px-3 py-1.5 text-xs hover:bg-neutral-50 ${
                    (field.config.numberFormat ?? "decimal") === f.value ? "text-blue-600 font-medium" : "text-neutral-700"
                  }`}
                  onClick={() => { onConfigUpdate?.(field.id, { ...field.config, numberFormat: f.value }); onClose() }}
                >
                  {f.label}
                  {(field.config.numberFormat ?? "decimal") === f.value && <span className="ml-auto text-blue-400 text-[10px]">✓</span>}
                </button>
              ))}
              {field.type === "date" && DATE_FORMATS.map((f) => (
                <button
                  key={f.value}
                  className={`w-full flex items-center gap-2 px-3 py-1.5 text-xs hover:bg-neutral-50 ${
                    (field.config.dateFormat ?? "MMM d, yyyy") === f.value ? "text-blue-600 font-medium" : "text-neutral-700"
                  }`}
                  onClick={() => { onConfigUpdate?.(field.id, { ...field.config, dateFormat: f.value }); onClose() }}
                >
                  {f.label}
                  {(field.config.dateFormat ?? "MMM d, yyyy") === f.value && <span className="ml-auto text-blue-400 text-[10px]">✓</span>}
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
              <button className="flex-1 text-xs border rounded py-1 hover:bg-neutral-50" onClick={onClose}>
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
