"use client"

import { useState } from "react"
import { ArrowLeft, Plus, Trash2, Save, GripVertical } from "lucide-react"
import { cn } from "@/lib/utils"
import type { Automation, AutomationAction, GenerateAIAction, PublishEtsyAction, SetFieldAction } from "@/types/automation"
import type { Field } from "@/types/core"
import { GenerateAIAction as GenerateAIForm } from "./GenerateAIAction"
import { PublishEtsyAction as PublishEtsyForm } from "./PublishEtsyAction"
import { SetFieldAction as SetFieldForm } from "./SetFieldAction"
import { DEFAULT_GENERATE_PROMPT } from "@/types/automation"

const TRIGGER_OPTIONS = [
  { value: "field_filled", label: "When field is filled" },
  { value: "row_created", label: "When row is created" },
  { value: "manual", label: "Manual only (Run button)" },
] as const

const ACTION_LABELS: Record<string, string> = {
  generate_ai: "Generate with AI",
  publish_etsy: "Publish to Etsy",
  set_field: "Set field value",
}

interface Props {
  automation: Automation
  fields: Field[]
  baseId: string
  onSave: (updated: Automation) => Promise<void>
  onDelete: () => void
  onBack: () => void
}

export function AutomationEditor({ automation, fields, baseId, onSave, onDelete, onBack }: Props) {
  const [draft, setDraft] = useState<Automation>({ ...automation, actions: [...automation.actions] })
  const [saving, setSaving] = useState(false)
  const [showAddAction, setShowAddAction] = useState(false)

  const update = <K extends keyof Automation>(key: K, value: Automation[K]) =>
    setDraft((prev) => ({ ...prev, [key]: value }))

  const updateAction = (index: number, action: AutomationAction) =>
    setDraft((prev) => {
      const actions = [...prev.actions]
      actions[index] = action
      return { ...prev, actions }
    })

  const removeAction = (index: number) =>
    setDraft((prev) => ({ ...prev, actions: prev.actions.filter((_, i) => i !== index) }))

  const addAction = (type: "generate_ai" | "publish_etsy" | "set_field") => {
    setShowAddAction(false)
    let action: AutomationAction
    if (type === "generate_ai") {
      action = { type: "generate_ai", prompt: DEFAULT_GENERATE_PROMPT, writeToFields: ["Title", "Tags", "Description"] } as GenerateAIAction
    } else if (type === "publish_etsy") {
      action = { type: "publish_etsy", publishState: "draft", requireApproval: true } as PublishEtsyAction
    } else {
      action = { type: "set_field", fieldName: "", value: "" } as SetFieldAction
    }
    setDraft((prev) => ({ ...prev, actions: [...prev.actions, action] }))
  }

  const handleSave = async () => {
    setSaving(true)
    try { await onSave(draft) } finally { setSaving(false) }
  }

  const fieldNameOptions = fields.map((f) => f.name)

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 border-b bg-white shrink-0">
        <button onClick={onBack} className="text-neutral-400 hover:text-neutral-700">
          <ArrowLeft size={16} />
        </button>
        <input
          value={draft.name}
          onChange={(e) => update("name", e.target.value)}
          className="flex-1 text-sm font-semibold text-neutral-800 outline-none bg-transparent border-b border-transparent focus:border-orange-300"
        />
        <button
          onClick={() => update("active", !draft.active)}
          className={cn(
            "w-10 h-5 rounded-full transition-colors relative shrink-0",
            draft.active ? "bg-orange-500" : "bg-neutral-200"
          )}
        >
          <span className={cn(
            "absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-all",
            draft.active ? "left-5" : "left-0.5"
          )} />
        </button>
        <button
          onClick={handleSave}
          disabled={saving}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-orange-500 text-white rounded hover:bg-orange-600 disabled:opacity-50 shrink-0"
        >
          <Save size={12} /> {saving ? "Saving…" : "Save"}
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-5 space-y-6 max-w-lg">

        {/* TRIGGER */}
        <section className="space-y-3">
          <h3 className="text-[11px] font-semibold text-neutral-400 uppercase tracking-wider">Trigger</h3>
          <div className="space-y-2">
            <select
              value={draft.trigger.type}
              onChange={(e) => update("trigger", { type: e.target.value as typeof draft.trigger.type })}
              className="w-full text-xs border rounded px-2 py-1.5 outline-none focus:border-orange-400"
            >
              {TRIGGER_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
            {draft.trigger.type === "field_filled" && (
              <div className="flex items-center gap-2">
                <span className="text-xs text-neutral-500 shrink-0">Field:</span>
                <select
                  value={draft.trigger.fieldName ?? ""}
                  onChange={(e) => update("trigger", { ...draft.trigger, fieldName: e.target.value })}
                  className="flex-1 text-xs border rounded px-2 py-1.5 outline-none focus:border-orange-400"
                >
                  <option value="">— select field —</option>
                  {fieldNameOptions.map((n) => <option key={n} value={n}>{n}</option>)}
                </select>
              </div>
            )}
          </div>
        </section>

        {/* FILTER */}
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-[11px] font-semibold text-neutral-400 uppercase tracking-wider">
              Filter <span className="normal-case font-normal">(optional)</span>
            </h3>
            {draft.filter
              ? <button onClick={() => update("filter", undefined)} className="text-[11px] text-neutral-400 hover:text-red-500">Remove</button>
              : <button onClick={() => update("filter", { fieldName: "Category", value: "" })} className="text-[11px] text-orange-500 hover:text-orange-700">+ Add filter</button>
            }
          </div>
          {draft.filter && (
            <div className="grid grid-cols-2 gap-2">
              <select
                value={draft.filter.fieldName}
                onChange={(e) => update("filter", { ...draft.filter!, fieldName: e.target.value })}
                className="text-xs border rounded px-2 py-1.5 outline-none focus:border-orange-400"
              >
                {fieldNameOptions.map((n) => <option key={n} value={n}>{n}</option>)}
              </select>
              <input
                value={draft.filter.value}
                onChange={(e) => update("filter", { ...draft.filter!, value: e.target.value })}
                placeholder="equals…"
                className="text-xs border rounded px-2 py-1.5 outline-none focus:border-orange-400"
              />
            </div>
          )}
        </section>

        {/* ACTIONS */}
        <section className="space-y-3">
          <h3 className="text-[11px] font-semibold text-neutral-400 uppercase tracking-wider">Actions</h3>

          {draft.actions.length === 0 && (
            <p className="text-[11px] text-neutral-400">No actions yet. Add one below.</p>
          )}

          {draft.actions.map((action, i) => (
            <div key={i} className="rounded-lg border bg-white overflow-hidden">
              <div className="flex items-center gap-2 px-3 py-2 bg-neutral-50 border-b">
                <GripVertical size={13} className="text-neutral-300" />
                <span className="flex-1 text-xs font-medium text-neutral-700">
                  {i + 1}. {ACTION_LABELS[action.type] ?? action.type}
                </span>
                <button onClick={() => removeAction(i)} className="text-neutral-300 hover:text-red-500">
                  <Trash2 size={13} />
                </button>
              </div>
              <div className="p-3">
                {action.type === "generate_ai" && (
                  <GenerateAIForm
                    action={action as GenerateAIAction}
                    fields={fields}
                    onChange={(a) => updateAction(i, a)}
                  />
                )}
                {action.type === "publish_etsy" && (
                  <PublishEtsyForm
                    action={action as PublishEtsyAction}
                    baseId={baseId}
                    onChange={(a) => updateAction(i, a)}
                  />
                )}
                {action.type === "set_field" && (
                  <SetFieldForm
                    action={action as SetFieldAction}
                    fields={fields}
                    onChange={(a) => updateAction(i, a)}
                  />
                )}
              </div>
            </div>
          ))}

          <div className="relative">
            <button
              onClick={() => setShowAddAction((v) => !v)}
              className="flex items-center gap-1.5 text-xs text-orange-500 hover:text-orange-700"
            >
              <Plus size={12} /> Add action
            </button>
            {showAddAction && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setShowAddAction(false)} />
                <div className="absolute left-0 top-full mt-1 z-50 w-48 bg-white border rounded-lg shadow-lg py-1">
                  {(["generate_ai", "publish_etsy", "set_field"] as const).map((type) => (
                    <button
                      key={type}
                      onClick={() => addAction(type)}
                      className="w-full text-left px-3 py-2 text-xs text-neutral-700 hover:bg-orange-50"
                    >
                      {ACTION_LABELS[type]}
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>
        </section>

        {/* Danger zone */}
        <section className="pt-4 border-t">
          <button
            onClick={onDelete}
            className="text-xs text-red-500 hover:text-red-700 hover:underline"
          >
            Delete automation
          </button>
        </section>
      </div>
    </div>
  )
}
