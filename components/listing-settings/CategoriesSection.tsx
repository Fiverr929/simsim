"use client"

import type { Field } from "@/types/core"
import type { ListingSettings } from "@/types/listing-settings"

interface Props {
  settings: ListingSettings
  fields: Field[]
  onSave: (patch: Partial<ListingSettings>) => Promise<void>
}

export function CategoriesSection({ settings: _settings, fields: _fields, onSave: _onSave }: Props) {
  return <div className="p-6 text-xs text-neutral-400">Categories — coming soon</div>
}
