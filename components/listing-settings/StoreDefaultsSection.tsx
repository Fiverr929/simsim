"use client"

import type { ListingSettings } from "@/types/listing-settings"

interface Props {
  settings: ListingSettings
  onSave: (patch: Partial<ListingSettings>) => Promise<void>
}

export function StoreDefaultsSection({ settings: _settings, onSave: _onSave }: Props) {
  return <div className="p-6 text-xs text-neutral-400">Store Defaults — coming soon</div>
}
