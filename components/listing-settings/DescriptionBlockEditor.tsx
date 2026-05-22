"use client"

import { useState } from "react"
import { Plus, Trash2, GripVertical } from "lucide-react"
import { cn } from "@/lib/utils"
import { newBlock } from "@/types/listing-settings"
import type { DescriptionBlock } from "@/types/listing-settings"

const BLOCK_LABELS: Record<DescriptionBlock["type"], string> = {
  fixed:       "Fixed",
  ai:          "AI",
  context_var: "Context var",
}

const BLOCK_COLORS: Record<DescriptionBlock["type"], string> = {
  fixed:       "bg-neutral-50 border-neutral-200",
  ai:          "bg-purple-50 border-purple-200",
  context_var: "bg-blue-50 border-blue-200",
}

interface Props {
  blocks: DescriptionBlock[]
  onChange: (blocks: DescriptionBlock[]) => void
}

export function DescriptionBlockEditor({ blocks, onChange }: Props) {
  const [dragIdx, setDragIdx] = useState<number | null>(null)
  const [dragOverIdx, setDragOverIdx] = useState<number | null>(null)

  const addBlock = (type: DescriptionBlock["type"]) => {
    onChange([...blocks, newBlock(type)])
  }

  const updateBlock = (id: string, content: string) => {
    onChange(blocks.map((b) => b.id === id ? { ...b, content } : b))
  }

  const removeBlock = (id: string) => {
    onChange(blocks.filter((b) => b.id !== id))
  }

  const onDrop = (toIdx: number) => {
    if (dragIdx === null || dragIdx === toIdx) return
    const reordered = [...blocks]
    const [moved] = reordered.splice(dragIdx, 1)
    reordered.splice(toIdx, 0, moved)
    onChange(reordered)
    setDragIdx(null)
    setDragOverIdx(null)
  }

  return (
    <div className="space-y-2">
      {blocks.length === 0 && (
        <div className="border-2 border-dashed rounded-lg p-4 text-center">
          <p className="text-[11px] text-neutral-400">No blocks yet — add one below.</p>
        </div>
      )}

      {blocks.map((block, i) => (
        <div
          key={block.id}
          draggable
          onDragStart={() => setDragIdx(i)}
          onDragOver={(e) => { e.preventDefault(); setDragOverIdx(i) }}
          onDrop={() => onDrop(i)}
          onDragEnd={() => { setDragIdx(null); setDragOverIdx(null) }}
          className={cn(
            "flex gap-2 rounded-lg border p-2 transition-all",
            BLOCK_COLORS[block.type],
            dragOverIdx === i && dragIdx !== i && "ring-2 ring-orange-300"
          )}
        >
          <div className="cursor-grab text-neutral-300 hover:text-neutral-500 mt-1">
            <GripVertical size={14} />
          </div>
          <div className="flex-1 space-y-1.5">
            <div className="flex items-center gap-2">
              <span className={cn(
                "text-[10px] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded",
                block.type === "fixed" ? "text-neutral-500 bg-neutral-100" :
                block.type === "ai" ? "text-purple-600 bg-purple-100" :
                "text-blue-600 bg-blue-100"
              )}>
                {BLOCK_LABELS[block.type]}
              </span>
            </div>
            <textarea
              value={block.content}
              onChange={(e) => updateBlock(block.id, e.target.value)}
              rows={block.type === "fixed" ? 3 : 2}
              placeholder={
                block.type === "fixed" ? "Static text that always appears verbatim…" :
                block.type === "ai" ? "AI instructions for this block (e.g. Write a 3-sentence description of the product mood and use case)" :
                "Variable name, e.g. title_hint"
              }
              className="w-full text-xs bg-transparent border-0 outline-none resize-y placeholder:text-neutral-300"
            />
          </div>
          <button
            onClick={() => removeBlock(block.id)}
            className="text-neutral-300 hover:text-red-500 self-start mt-1 shrink-0"
          >
            <Trash2 size={13} />
          </button>
        </div>
      ))}

      <div className="flex gap-2 pt-1">
        {(["fixed", "ai", "context_var"] as DescriptionBlock["type"][]).map((type) => (
          <button
            key={type}
            onClick={() => addBlock(type)}
            className={cn(
              "flex items-center gap-1 px-2 py-1 rounded text-[11px] border transition-colors",
              type === "fixed" ? "border-neutral-200 text-neutral-600 hover:bg-neutral-50" :
              type === "ai" ? "border-purple-200 text-purple-600 hover:bg-purple-50" :
              "border-blue-200 text-blue-600 hover:bg-blue-50"
            )}
          >
            <Plus size={11} /> {BLOCK_LABELS[type]}
          </button>
        ))}
      </div>
    </div>
  )
}
