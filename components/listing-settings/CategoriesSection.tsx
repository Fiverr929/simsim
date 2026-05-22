"use client"

import { useState } from "react"
import { Plus, Trash2, ChevronRight } from "lucide-react"
import { cn } from "@/lib/utils"
import { newCategory } from "@/types/listing-settings"
import type { ListingSettings, ListingCategory } from "@/types/listing-settings"
import type { Field } from "@/types/core"
import { CategoryEditor } from "./CategoryEditor"
import { ConfirmDialog } from "@/components/ui/ConfirmDialog"

interface Props {
  settings: ListingSettings
  fields: Field[]
  onSave: (patch: Partial<ListingSettings>) => Promise<void>
}

export function CategoriesSection({ settings, fields, onSave }: Props) {
  const [editing, setEditing] = useState<ListingCategory | null>(null)
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)

  const addCategory = async () => {
    const cat = newCategory()
    await onSave({ categories: [...settings.categories, cat] })
    setEditing(cat)
  }

  const deleteCategory = async (id: string) => {
    await onSave({ categories: settings.categories.filter((c) => c.id !== id) })
    if (editing?.id === id) setEditing(null)
  }

  const saveCategory = async (updated: ListingCategory) => {
    await onSave({
      categories: settings.categories.map((c) => c.id === updated.id ? updated : c),
    })
    setEditing(updated)
  }

  if (editing) {
    return (
      <CategoryEditor
        category={editing}
        fields={fields}
        settings={settings}
        onSave={saveCategory}
        onBack={() => setEditing(null)}
      />
    )
  }

  return (
    <div className="p-6 max-w-xl space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-sm font-semibold text-neutral-800">Categories</h2>
          <p className="text-xs text-neutral-500 mt-0.5">
            Each category is an automation profile — trigger, field roles, AI template, and publish rules.
          </p>
        </div>
        <button
          onClick={addCategory}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-orange-500 text-white rounded hover:bg-orange-600"
        >
          <Plus size={12} /> New category
        </button>
      </div>

      {settings.categories.length === 0 && (
        <div className="border-2 border-dashed rounded-lg p-8 text-center">
          <p className="text-xs text-neutral-400">No categories yet.</p>
          <p className="text-[11px] text-neutral-300 mt-1">Create one to define automation rules for a product type.</p>
        </div>
      )}

      <div className="space-y-1">
        {settings.categories.map((cat) => (
          <div
            key={cat.id}
            className="group flex items-center gap-3 p-3 rounded-lg border bg-white hover:border-orange-200 cursor-pointer transition-colors"
            onClick={() => setEditing(cat)}
          >
            <span className="text-base select-none">{cat.icon}</span>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium text-neutral-800">{cat.name}</p>
              <p className="text-[11px] text-neutral-400 truncate">
                Trigger: {cat.trigger.type.replace(/_/g, " ")} ·{" "}
                {cat.autoRun ? "Auto-run ON" : "Manual"}
              </p>
            </div>
            <ChevronRight size={14} className="text-neutral-300 group-hover:text-neutral-500 shrink-0" />
            <button
              className="opacity-0 group-hover:opacity-100 p-1 text-neutral-300 hover:text-red-500 rounded shrink-0"
              onClick={(e) => { e.stopPropagation(); setConfirmDeleteId(cat.id) }}
            >
              <Trash2 size={13} />
            </button>
          </div>
        ))}
      </div>

      {confirmDeleteId && (
        <ConfirmDialog
          title="Delete category?"
          description={`"${settings.categories.find((c) => c.id === confirmDeleteId)?.name}" and all its rules will be permanently deleted.`}
          onConfirm={() => { deleteCategory(confirmDeleteId); setConfirmDeleteId(null) }}
          onCancel={() => setConfirmDeleteId(null)}
        />
      )}
    </div>
  )
}
