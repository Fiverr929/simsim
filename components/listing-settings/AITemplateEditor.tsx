"use client"
import type { DescriptionBlock, PromptTemplate } from "@/types/listing-settings"
interface Props {
  templateOverride?: string
  descriptionBlocks: DescriptionBlock[]
  templates: PromptTemplate[]
  selectedTemplateId?: string
  onTemplateChange: (id: string) => void
  onOverrideChange: (v: string) => void
  onBlocksChange: (blocks: DescriptionBlock[]) => void
}
export function AITemplateEditor({ templateOverride: _t, descriptionBlocks: _d, templates: _ts, selectedTemplateId: _s, onTemplateChange: _tc, onOverrideChange: _oc, onBlocksChange: _bc }: Props) {
  return <div className="p-4 text-xs text-neutral-400">AI template editor — coming in next task</div>
}
