"use client"

import { useCallback, useEffect, useState } from "react"
import type { ReactNode } from "react"
import { X, SlidersHorizontal, Tag, Library } from "lucide-react"
import { toast } from "sonner"
import { cn } from "@/lib/utils"
import { emptySettings } from "@/types/listing-settings"
import type { ListingSettings } from "@/types/listing-settings"
import type { Field } from "@/types/core"
import { StoreDefaultsSection } from "./StoreDefaultsSection"
import { CategoriesSection } from "./CategoriesSection"
import { TemplatesLibrary } from "./TemplatesLibrary"

type NavItem = "defaults" | "categories" | "templates"

const NAV: Array<{ id: NavItem; label: string; icon: ReactNode }> = [
  { id: "defaults",   label: "Store Defaults", icon: <SlidersHorizontal size={14} /> },
  { id: "categories", label: "Categories",     icon: <Tag size={14} /> },
  { id: "templates",  label: "Templates",      icon: <Library size={14} /> },
]

interface Props {
  baseId: string
  fields: Field[]
  onClose: () => void
}

export function ListingSettingsPanel({ baseId, fields, onClose }: Props) {
  const [active, setActive] = useState<NavItem>("defaults")
  const [settings, setSettings] = useState<ListingSettings>(emptySettings())
  const [saving, setSaving] = useState(false)

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/listing-settings/${baseId}`)
      if (res.ok) setSettings(await res.json())
      else toast.error("Failed to load settings")
    } catch {
      toast.error("Failed to load settings")
    }
  }, [baseId])

  useEffect(() => { load() }, [load])

  const save = useCallback(async (patch: Partial<ListingSettings>) => {
    setSaving(true)
    try {
      const res = await fetch(`/api/listing-settings/${baseId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      })
      if (!res.ok) { toast.error("Failed to save settings"); return }
      const updated: ListingSettings = await res.json()
      setSettings(updated)
    } finally {
      setSaving(false)
    }
  }, [baseId])

  return (
    <div className="flex flex-1 overflow-hidden">
      {/* Left nav */}
      <div className="w-44 border-r bg-neutral-50 flex flex-col shrink-0">
        <div className="px-3 py-3 border-b">
          <p className="text-xs font-semibold text-neutral-700">Listing Settings</p>
          {saving && <p className="text-[10px] text-neutral-400 mt-0.5">Saving…</p>}
        </div>
        <nav className="flex-1 p-2 space-y-0.5">
          {NAV.map((item) => (
            <button
              key={item.id}
              onClick={() => setActive(item.id)}
              className={cn(
                "w-full flex items-center gap-2 px-2 py-1.5 rounded text-xs transition-colors",
                active === item.id
                  ? "bg-orange-50 text-orange-600 font-medium"
                  : "text-neutral-600 hover:bg-neutral-100"
              )}
            >
              {item.icon}
              {item.label}
            </button>
          ))}
        </nav>
        <div className="p-2 border-t">
          <button
            onClick={onClose}
            className="w-full flex items-center gap-2 px-2 py-1.5 rounded text-xs text-neutral-500 hover:bg-neutral-100"
          >
            <X size={13} /> Close settings
          </button>
        </div>
      </div>

      {/* Right content */}
      <div className="flex-1 overflow-y-auto">
        {active === "defaults" && (
          <StoreDefaultsSection settings={settings} onSave={save} />
        )}
        {active === "categories" && (
          <CategoriesSection settings={settings} fields={fields} onSave={save} />
        )}
        {active === "templates" && (
          <TemplatesLibrary settings={settings} onSave={save} />
        )}
      </div>
    </div>
  )
}
