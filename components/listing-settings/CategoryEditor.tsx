"use client"

import { useState } from "react"
import { ArrowLeft, Save } from "lucide-react"
import { cn } from "@/lib/utils"
import type { ListingCategory, ListingSettings } from "@/types/listing-settings"
import type { Field } from "@/types/core"
import { TriggerConfig } from "./TriggerConfig"
import { FieldRoleTable } from "./FieldRoleTable"
import { AITemplateEditor } from "./AITemplateEditor"
import { DescriptionBlockEditor as _DescriptionBlockEditor } from "./DescriptionBlockEditor"
import { PostProcessRules } from "./PostProcessRules"

type Tab = "identity" | "trigger" | "fields" | "ai" | "postprocess"

const TABS: Array<{ id: Tab; label: string }> = [
  { id: "identity",    label: "Identity" },
  { id: "trigger",     label: "Trigger" },
  { id: "fields",      label: "Fields" },
  { id: "ai",          label: "AI Template" },
  { id: "postprocess", label: "Post-Process" },
]

const ICON_OPTIONS = ["🖼️","🎨","✏️","🏷️","📦","🌟","💎","🎭","🖌️","📐"]
const COLOR_OPTIONS = ["#6366f1","#f97316","#22c55e","#3b82f6","#ec4899","#eab308","#14b8a6","#a855f7"]

interface Props {
  category: ListingCategory
  fields: Field[]
  settings: ListingSettings
  onSave: (updated: ListingCategory) => Promise<void>
  onBack: () => void
}

export function CategoryEditor({ category, fields, settings, onSave, onBack }: Props) {
  const [draft, setDraft] = useState<ListingCategory>({ ...category })
  const [activeTab, setActiveTab] = useState<Tab>("identity")
  const [saving, setSaving] = useState(false)

  const update = <K extends keyof ListingCategory>(key: K, value: ListingCategory[K]) =>
    setDraft((prev) => ({ ...prev, [key]: value }))

  const handleSave = async () => {
    setSaving(true)
    try { await onSave(draft) } finally { setSaving(false) }
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 border-b bg-white shrink-0">
        <button onClick={onBack} className="text-neutral-400 hover:text-neutral-700">
          <ArrowLeft size={16} />
        </button>
        <span className="text-base select-none">{draft.icon}</span>
        <h2 className="text-sm font-semibold text-neutral-800 flex-1">{draft.name}</h2>
        <button
          onClick={handleSave}
          disabled={saving}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-orange-500 text-white rounded hover:bg-orange-600 disabled:opacity-50"
        >
          <Save size={12} /> {saving ? "Saving…" : "Save"}
        </button>
      </div>

      {/* Tabs */}
      <div className="flex gap-0.5 px-4 border-b bg-white shrink-0">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={cn(
              "px-3 py-2 text-xs border-b-2 transition-colors",
              activeTab === tab.id
                ? "border-orange-500 text-orange-600 font-medium"
                : "border-transparent text-neutral-500 hover:text-neutral-700"
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-5">

        {/* Identity */}
        {activeTab === "identity" && (
          <div className="max-w-md space-y-4">
            <div>
              <label className="text-xs font-medium text-neutral-700 block mb-1">Name</label>
              <input
                value={draft.name}
                onChange={(e) => update("name", e.target.value)}
                className="w-full text-xs border rounded px-2 py-1.5 outline-none focus:border-orange-400"
              />
            </div>

            <div>
              <label className="text-xs font-medium text-neutral-700 block mb-1">Icon</label>
              <div className="flex flex-wrap gap-1.5">
                {ICON_OPTIONS.map((icon) => (
                  <button
                    key={icon}
                    onClick={() => update("icon", icon)}
                    className={cn(
                      "w-8 h-8 text-base rounded border transition-colors",
                      draft.icon === icon ? "border-orange-400 bg-orange-50" : "border-neutral-200 hover:border-neutral-300"
                    )}
                  >
                    {icon}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="text-xs font-medium text-neutral-700 block mb-1">Color</label>
              <div className="flex gap-1.5">
                {COLOR_OPTIONS.map((color) => (
                  <button
                    key={color}
                    onClick={() => update("color", color)}
                    style={{ backgroundColor: color }}
                    className={cn(
                      "w-6 h-6 rounded-full border-2 transition-all",
                      draft.color === color ? "border-neutral-800 scale-110" : "border-transparent"
                    )}
                  />
                ))}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              {[
                { key: "shopSectionId" as const,  label: "Shop Section ID" },
                { key: "taxonomyId" as const,      label: "Taxonomy ID" },
                { key: "returnPolicyId" as const,  label: "Return Policy ID" },
                { key: "defaultPrice" as const,    label: "Default Price ($)" },
              ].map(({ key, label }) => (
                <div key={key}>
                  <label className="text-xs font-medium text-neutral-700 block mb-1">{label}</label>
                  <input
                    type="number"
                    value={draft[key] ?? ""}
                    onChange={(e) => update(key, e.target.value ? Number(e.target.value) : undefined)}
                    className="w-full text-xs border rounded px-2 py-1.5 outline-none focus:border-orange-400"
                  />
                </div>
              ))}
            </div>

            {/* Publish rules */}
            <div className="pt-2 border-t space-y-3">
              <h3 className="text-xs font-semibold text-neutral-600 uppercase tracking-wider">Publish Rules</h3>
              <div className="flex items-center gap-3">
                <label className="text-xs text-neutral-700 w-32 shrink-0">Default state</label>
                <select
                  value={draft.publishState}
                  onChange={(e) => update("publishState", e.target.value as "draft" | "active")}
                  className="text-xs border rounded px-2 py-1 outline-none focus:border-orange-400"
                >
                  <option value="draft">Draft</option>
                  <option value="active">Active (publish immediately)</option>
                </select>
              </div>
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={draft.autoRun}
                  onChange={(e) => update("autoRun", e.target.checked)}
                  className="w-4 h-4 rounded accent-orange-500"
                />
                <span className="text-xs text-neutral-700">Auto-run automation for this category</span>
              </label>
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={draft.requireApproval}
                  onChange={(e) => update("requireApproval", e.target.checked)}
                  className="w-4 h-4 rounded accent-orange-500"
                />
                <span className="text-xs text-neutral-700">Require manual approval before publishing</span>
              </label>
            </div>
          </div>
        )}

        {activeTab === "trigger" && (
          <div className="max-w-md">
            <p className="text-xs text-neutral-500 mb-4">
              Define what starts the automation for rows in this category.
            </p>
            <TriggerConfig
              trigger={draft.trigger}
              onChange={(t) => update("trigger", t)}
            />
          </div>
        )}

        {activeTab === "fields" && (
          <FieldRoleTable
            fieldRoles={draft.fieldRoles}
            fields={fields}
            onChange={(roles) => update("fieldRoles", roles)}
          />
        )}

        {activeTab === "ai" && (
          <AITemplateEditor
            templateOverride={draft.templateOverride}
            descriptionBlocks={draft.descriptionBlocks}
            templates={settings.templates}
            selectedTemplateId={draft.templateId}
            onTemplateChange={(id) => update("templateId", id)}
            onOverrideChange={(v) => update("templateOverride", v)}
            onBlocksChange={(blocks) => update("descriptionBlocks", blocks)}
          />
        )}

        {activeTab === "postprocess" && (
          <PostProcessRules
            rules={draft.postProcessRules}
            fields={fields}
            onChange={(rules) => update("postProcessRules", rules)}
          />
        )}
      </div>
    </div>
  )
}
