"use client"

import { useCallback, useEffect, useState } from "react"
import { Plus, X, Zap } from "lucide-react"
import { toast } from "sonner"
import { cn } from "@/lib/utils"
import { newAutomation } from "@/types/automation"
import type { Automation } from "@/types/automation"
import { AutomationEditor } from "./AutomationEditor"
import type { Field } from "@/types/core"

interface Props {
  baseId: string
  fields: Field[]
  onClose: () => void
}

export function AutomationsPanel({ baseId, fields, onClose }: Props) {
  const [automations, setAutomations] = useState<Automation[]>([])
  const [editing, setEditing] = useState<Automation | null>(null)
  const [saving, setSaving] = useState(false)

  const load = useCallback(async () => {
    const res = await fetch(`/api/automations/${baseId}`)
    if (res.ok) setAutomations(await res.json())
    else toast.error("Failed to load automations")
  }, [baseId])

  useEffect(() => { load() }, [load])

  const save = useCallback(async (next: Automation[]) => {
    setSaving(true)
    try {
      const res = await fetch(`/api/automations/${baseId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(next),
      })
      if (!res.ok) { toast.error("Failed to save"); return }
      const saved: Automation[] = await res.json()
      setAutomations(saved)
    } finally {
      setSaving(false)
    }
  }, [baseId])

  const addAutomation = async () => {
    const a = newAutomation()
    const next = [...automations, a]
    await save(next)
    setEditing(a)
  }

  const toggleActive = async (id: string) => {
    const next = automations.map((a) => a.id === id ? { ...a, active: !a.active } : a)
    await save(next)
  }

  const saveAutomation = async (updated: Automation) => {
    const next = automations.map((a) => a.id === updated.id ? updated : a)
    await save(next)
    setEditing(updated)
  }

  const deleteAutomation = async (id: string) => {
    const next = automations.filter((a) => a.id !== id)
    await save(next)
    if (editing?.id === id) setEditing(null)
  }

  if (editing) {
    return (
      <AutomationEditor
        automation={editing}
        fields={fields}
        baseId={baseId}
        onSave={saveAutomation}
        onDelete={() => deleteAutomation(editing.id)}
        onBack={() => setEditing(null)}
      />
    )
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between px-4 py-3 border-b bg-white shrink-0">
        <div className="flex items-center gap-2">
          <Zap size={14} className="text-orange-500" />
          <span className="text-sm font-semibold text-neutral-800">Automations</span>
          {saving && <span className="text-[10px] text-neutral-400">Saving…</span>}
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={addAutomation}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-orange-500 text-white rounded hover:bg-orange-600"
          >
            <Plus size={12} /> New
          </button>
          <button onClick={onClose} className="text-neutral-400 hover:text-neutral-700">
            <X size={16} />
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-2">
        {automations.length === 0 && (
          <div className="border-2 border-dashed rounded-lg p-10 text-center">
            <Zap size={20} className="text-neutral-300 mx-auto mb-2" />
            <p className="text-xs text-neutral-400">No automations yet.</p>
            <p className="text-[11px] text-neutral-300 mt-1">Create one to generate listings automatically.</p>
          </div>
        )}

        {automations.map((a) => (
          <div
            key={a.id}
            className="group flex items-center gap-3 px-3 py-2.5 rounded-lg border bg-white hover:border-orange-200 cursor-pointer transition-colors"
            onClick={() => setEditing(a)}
          >
            <button
              onClick={(e) => { e.stopPropagation(); toggleActive(a.id) }}
              className={cn(
                "w-8 h-4 rounded-full transition-colors shrink-0 relative",
                a.active ? "bg-orange-500" : "bg-neutral-200"
              )}
            >
              <span className={cn(
                "absolute top-0.5 w-3 h-3 rounded-full bg-white shadow transition-all",
                a.active ? "left-4" : "left-0.5"
              )} />
            </button>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium text-neutral-800">{a.name}</p>
              <p className="text-[11px] text-neutral-400 truncate">
                {a.trigger.type === "field_filled"
                  ? `When ${a.trigger.fieldName ?? "field"} filled`
                  : a.trigger.type === "row_created"
                  ? "When row created"
                  : "Manual only"}
                {a.filter ? ` · ${a.filter.fieldName} = ${a.filter.value}` : ""}
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
