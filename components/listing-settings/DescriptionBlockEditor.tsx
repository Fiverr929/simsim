"use client"
import type { DescriptionBlock } from "@/types/listing-settings"
interface Props { blocks: DescriptionBlock[]; onChange: (blocks: DescriptionBlock[]) => void }
export function DescriptionBlockEditor({ blocks: _blocks, onChange: _onChange }: Props) {
  return <div className="p-4 text-xs text-neutral-400">Description block editor — coming in next task</div>
}
