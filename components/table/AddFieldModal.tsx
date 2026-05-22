"use client"

import { useEffect, useState } from "react"
import { X } from "lucide-react"
import type { FieldType } from "@/types/core"
import { cn } from "@/lib/utils"
import { FIELD_TYPE_META } from "@/lib/field-types"

interface Props {
  onAdd: (name: string, type: FieldType) => Promise<void>
  onClose: () => void
}

export function AddFieldModal({ onAdd, onClose }: Props) {
  const [name, setName] = useState("Field")
  const [type, setType] = useState<FieldType>("text")
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose() }
    document.addEventListener("keydown", handler)
    return () => document.removeEventListener("keydown", handler)
  }, [onClose])

  const submit = async () => {
    setSaving(true)
    try {
      await onAdd(name.trim() || "Field", type)
      onClose()
    } catch {
      setSaving(false)
    }
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
              {FIELD_TYPE_META.map((ft) => (
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
