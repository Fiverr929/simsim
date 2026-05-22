"use client"

import { useState } from "react"
import type { ListingSettings } from "@/types/listing-settings"

interface Props {
  settings: ListingSettings
  onSave: (patch: Partial<ListingSettings>) => Promise<void>
}

export function StoreDefaultsSection({ settings, onSave }: Props) {
  const [draft, setDraft] = useState({ ...settings })

  const update = <K extends keyof ListingSettings>(key: K, value: ListingSettings[K]) => {
    setDraft((prev) => ({ ...prev, [key]: value }))
  }

  const updateDefault = (fieldName: string, value: string | number | boolean | null) => {
    setDraft((prev) => ({
      ...prev,
      fieldDefaults: { ...prev.fieldDefaults, [fieldName]: value },
    }))
  }

  const handleSave = () => {
    onSave({
      fieldDefaults: draft.fieldDefaults,
      globalAutoRun: draft.globalAutoRun,
      batchSize: draft.batchSize,
      defaultCategoryId: draft.defaultCategoryId,
    })
  }

  return (
    <div className="p-6 max-w-xl space-y-6">
      <div>
        <h2 className="text-sm font-semibold text-neutral-800 mb-1">Store Defaults</h2>
        <p className="text-xs text-neutral-500">
          Fields with defaults are pre-filled silently and hidden from the grid unless overridden by a category.
        </p>
      </div>

      {/* Automation */}
      <section className="space-y-3">
        <h3 className="text-xs font-semibold text-neutral-600 uppercase tracking-wider">Automation</h3>
        <label className="flex items-center gap-3 cursor-pointer">
          <input
            type="checkbox"
            checked={draft.globalAutoRun}
            onChange={(e) => update("globalAutoRun", e.target.checked)}
            className="w-4 h-4 rounded accent-orange-500"
          />
          <div>
            <p className="text-xs font-medium text-neutral-700">Auto-run on trigger</p>
            <p className="text-[11px] text-neutral-400">
              When a category trigger fires, start generation automatically (can be overridden per category)
            </p>
          </div>
        </label>
        <div className="flex items-center gap-3">
          <label className="text-xs text-neutral-700 w-28 shrink-0">Batch size limit</label>
          <input
            type="number"
            min={1} max={12}
            value={draft.batchSize}
            onChange={(e) => update("batchSize", Math.min(12, Math.max(1, Number(e.target.value))))}
            className="w-20 text-xs border rounded px-2 py-1 outline-none focus:border-orange-400"
          />
          <span className="text-[11px] text-neutral-400">max 12</span>
        </div>
      </section>

      {/* Field defaults */}
      <section className="space-y-3">
        <h3 className="text-xs font-semibold text-neutral-600 uppercase tracking-wider">Field Defaults</h3>
        <div className="space-y-2">
          {Object.entries(draft.fieldDefaults).map(([name, value]) => (
            <div key={name} className="flex items-center gap-3">
              <span className="text-xs text-neutral-700 w-44 shrink-0">{name}</span>
              <input
                type={typeof value === "boolean" ? "checkbox" : typeof value === "number" ? "number" : "text"}
                checked={typeof value === "boolean" ? value : undefined}
                value={typeof value === "boolean" ? undefined : String(value ?? "")}
                onChange={(e) => {
                  if (typeof value === "boolean") updateDefault(name, e.target.checked)
                  else if (typeof value === "number") updateDefault(name, Number(e.target.value))
                  else updateDefault(name, e.target.value)
                }}
                className="flex-1 text-xs border rounded px-2 py-1 outline-none focus:border-orange-400 w-4 h-4"
              />
            </div>
          ))}
        </div>
        <p className="text-[11px] text-neutral-400">
          Defaults are applied globally. Category-level defaults override these.
        </p>
      </section>

      <button
        onClick={handleSave}
        className="px-4 py-1.5 text-xs bg-orange-500 text-white rounded hover:bg-orange-600 transition-colors"
      >
        Save defaults
      </button>
    </div>
  )
}
