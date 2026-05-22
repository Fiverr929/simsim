"use client"
import type { PostProcessRule } from "@/types/listing-settings"
import type { Field } from "@/types/core"
interface Props { rules: PostProcessRule[]; fields: Field[]; onChange: (rules: PostProcessRule[]) => void }
export function PostProcessRules({ rules: _rules, fields: _fields, onChange: _onChange }: Props) {
  return <div className="p-4 text-xs text-neutral-400">Post-process rules — coming in next task</div>
}
