"use client"
import type { ListingSettings } from "@/types/listing-settings"
interface Props { settings: ListingSettings; onSave: (patch: Partial<ListingSettings>) => Promise<void> }
export function TemplatesLibrary({ settings: _settings, onSave: _onSave }: Props) {
  return <div className="p-4 text-xs text-neutral-400">Templates library — coming in next task</div>
}
