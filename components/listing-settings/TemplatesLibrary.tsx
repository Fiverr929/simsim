"use client"

import { useState } from "react"
import { Plus, Trash2, ChevronDown, ChevronRight } from "lucide-react"
import { v4 as uuid } from "uuid"
import type { PromptTemplate, ListingSettings } from "@/types/listing-settings"
import { TEMPLATE_VARIABLES } from "@/types/listing-settings"
import { ConfirmDialog } from "@/components/ui/ConfirmDialog"

interface Props {
  settings: ListingSettings
  onSave: (patch: Partial<ListingSettings>) => Promise<void>
}

function newTemplate(): PromptTemplate {
  return {
    id: uuid(),
    name: "New Template",
    description: "",
    prompt: "",
  }
}

export function TemplatesLibrary({ settings, onSave }: Props) {
  const [expanded, setExpanded] = useState<string | null>(null)
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)
  const [drafts, setDrafts] = useState<Record<string, PromptTemplate>>({})

  const startEdit = (t: PromptTemplate) => {
    setDrafts((prev) => ({ ...prev, [t.id]: { ...t } }))
    setExpanded(t.id)
  }

  const updateDraft = (id: string, patch: Partial<PromptTemplate>) => {
    setDrafts((prev) => ({ ...prev, [id]: { ...prev[id], ...patch } }))
  }

  const saveTemplate = async (id: string) => {
    const draft = drafts[id]
    if (!draft) return
    await onSave({ templates: settings.templates.map((t) => t.id === id ? draft : t) })
    setExpanded(null)
  }

  const addTemplate = async () => {
    const t = newTemplate()
    await onSave({ templates: [...settings.templates, t] })
    startEdit(t)
  }

  const deleteTemplate = async (id: string) => {
    await onSave({ templates: settings.templates.filter((t) => t.id !== id) })
  }

  return (
    <div className="p-6 max-w-2xl space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-sm font-semibold text-neutral-800">Templates Library</h2>
          <p className="text-xs text-neutral-500 mt-0.5">
            Reusable AI prompts. Categories can inherit a base template and override specific parts.
          </p>
        </div>
        <button
          onClick={addTemplate}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-orange-500 text-white rounded hover:bg-orange-600"
        >
          <Plus size={12} /> New template
        </button>
      </div>

      {settings.templates.length === 0 && (
        <div className="border-2 border-dashed rounded-lg p-8 text-center">
          <p className="text-xs text-neutral-400">No templates yet.</p>
        </div>
      )}

      <div className="space-y-2">
        {settings.templates.map((t) => {
          const draft = drafts[t.id] ?? t
          const isOpen = expanded === t.id
          return (
            <div key={t.id} className="rounded-lg border bg-white overflow-hidden">
              <div
                className="flex items-center gap-2 px-3 py-2.5 cursor-pointer hover:bg-neutral-50"
                onClick={() => isOpen ? setExpanded(null) : startEdit(t)}
              >
                {isOpen ? <ChevronDown size={13} className="text-neutral-400" /> : <ChevronRight size={13} className="text-neutral-400" />}
                <span className="flex-1 text-xs font-medium text-neutral-800">{t.name}</span>
                {t.description && (
                  <span className="text-[11px] text-neutral-400 truncate max-w-xs">{t.description}</span>
                )}
                <button
                  onClick={(e) => { e.stopPropagation(); setConfirmDeleteId(t.id) }}
                  className="text-neutral-300 hover:text-red-500 ml-2 shrink-0"
                >
                  <Trash2 size={13} />
                </button>
              </div>

              {isOpen && (
                <div className="px-4 pb-4 space-y-3 border-t bg-white">
                  <div className="pt-3 grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs font-medium text-neutral-700 block mb-1">Name</label>
                      <input
                        value={draft.name}
                        onChange={(e) => updateDraft(t.id, { name: e.target.value })}
                        className="w-full text-xs border rounded px-2 py-1.5 outline-none focus:border-orange-400"
                      />
                    </div>
                    <div>
                      <label className="text-xs font-medium text-neutral-700 block mb-1">Description</label>
                      <input
                        value={draft.description}
                        onChange={(e) => updateDraft(t.id, { description: e.target.value })}
                        className="w-full text-xs border rounded px-2 py-1.5 outline-none focus:border-orange-400"
                      />
                    </div>
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="text-xs font-medium text-neutral-700">Prompt</label>
                      <details className="text-[11px] text-orange-500 cursor-pointer">
                        <summary>Available variables</summary>
                        <div className="absolute z-10 mt-1 p-2 rounded-lg bg-orange-50 border border-orange-100 space-y-1 text-[11px] w-72">
                          {TEMPLATE_VARIABLES.map((v) => (
                            <div key={v.name} className="flex items-start gap-2">
                              <code className="text-orange-600 font-mono shrink-0">{v.name}</code>
                              <span className="text-neutral-500">{v.description}</span>
                            </div>
                          ))}
                        </div>
                      </details>
                    </div>
                    <textarea
                      value={draft.prompt}
                      onChange={(e) => updateDraft(t.id, { prompt: e.target.value })}
                      rows={6}
                      className="w-full text-xs border rounded px-2 py-1.5 outline-none focus:border-orange-400 font-mono resize-y"
                    />
                  </div>

                  <div className="flex gap-2">
                    <button
                      onClick={() => saveTemplate(t.id)}
                      className="px-3 py-1.5 text-xs bg-orange-500 text-white rounded hover:bg-orange-600"
                    >
                      Save template
                    </button>
                    <button
                      onClick={() => setExpanded(null)}
                      className="px-3 py-1.5 text-xs text-neutral-500 hover:bg-neutral-100 rounded"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}
            </div>
          )
        })}
      </div>

      {confirmDeleteId && (
        <ConfirmDialog
          title="Delete template?"
          description="Any categories using this template will fall back to their inline prompt."
          onConfirm={() => { deleteTemplate(confirmDeleteId); setConfirmDeleteId(null) }}
          onCancel={() => setConfirmDeleteId(null)}
        />
      )}
    </div>
  )
}
