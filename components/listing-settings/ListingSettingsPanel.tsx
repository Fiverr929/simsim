"use client"
import type { Field } from "@/types/core"
interface Props { baseId: string; fields: Field[]; onClose: () => void }
export function ListingSettingsPanel({ onClose }: Props) {
  return (
    <div className="flex-1 flex items-center justify-center text-xs text-neutral-400">
      <button onClick={onClose}>Settings panel — coming soon</button>
    </div>
  )
}
