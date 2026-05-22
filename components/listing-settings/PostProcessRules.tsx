"use client"

import { Plus, Trash2 } from "lucide-react"
import { newPostProcessRule } from "@/types/listing-settings"
import type { PostProcessRule } from "@/types/listing-settings"
import type { Field } from "@/types/core"

const RULE_TYPES: Array<{ value: PostProcessRule["type"]; label: string; valuePlaceholder: string; hasReplacement: boolean }> = [
  { value: "append_tags",      label: "Always include tags",   valuePlaceholder: "tag1, tag2, tag3",  hasReplacement: false },
  { value: "exclude_tags",     label: "Always exclude tags",   valuePlaceholder: "tag1, tag2, tag3",  hasReplacement: false },
  { value: "max_chars",        label: "Max characters",        valuePlaceholder: "140",               hasReplacement: false },
  { value: "capitalize_first", label: "Capitalize first word", valuePlaceholder: "(no value needed)", hasReplacement: false },
  { value: "regex_replace",    label: "Regex find/replace",    valuePlaceholder: "pattern",           hasReplacement: true  },
]

interface Props {
  rules: PostProcessRule[]
  fields: Field[]
  onChange: (rules: PostProcessRule[]) => void
}

export function PostProcessRules({ rules, fields, onChange }: Props) {
  const add = () => onChange([...rules, newPostProcessRule(fields[0]?.name ?? "Tags")])
  const remove = (id: string) => onChange(rules.filter((r) => r.id !== id))
  const update = (id: string, patch: Partial<PostProcessRule>) =>
    onChange(rules.map((r) => r.id === id ? { ...r, ...patch } : r))

  return (
    <div className="max-w-2xl space-y-4">
      <p className="text-xs text-neutral-500">
        Rules run after AI generation. Applied in order — top to bottom.
      </p>

      {rules.length === 0 && (
        <div className="border-2 border-dashed rounded-lg p-4 text-center">
          <p className="text-[11px] text-neutral-400">No rules yet.</p>
        </div>
      )}

      <div className="space-y-2">
        {rules.map((rule) => {
          const meta = RULE_TYPES.find((t) => t.value === rule.type)!
          return (
            <div key={rule.id} className="flex items-start gap-2 p-2 rounded-lg border bg-white">
              <div className="flex-1 grid grid-cols-3 gap-2">
                {/* Field */}
                <select
                  value={rule.fieldName}
                  onChange={(e) => update(rule.id, { fieldName: e.target.value })}
                  className="text-xs border rounded px-1.5 py-1 outline-none focus:border-orange-400"
                >
                  {fields.map((f) => <option key={f.id} value={f.name}>{f.name}</option>)}
                </select>
                {/* Rule type */}
                <select
                  value={rule.type}
                  onChange={(e) => update(rule.id, { type: e.target.value as PostProcessRule["type"] })}
                  className="text-xs border rounded px-1.5 py-1 outline-none focus:border-orange-400"
                >
                  {RULE_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
                </select>
                {/* Value */}
                <input
                  value={rule.value}
                  onChange={(e) => update(rule.id, { value: e.target.value })}
                  placeholder={meta.valuePlaceholder}
                  className="text-xs border rounded px-1.5 py-1 outline-none focus:border-orange-400"
                />
                {/* Replacement (regex only) */}
                {meta.hasReplacement && (
                  <input
                    value={rule.replacement ?? ""}
                    onChange={(e) => update(rule.id, { replacement: e.target.value })}
                    placeholder="replacement"
                    className="col-start-3 text-xs border rounded px-1.5 py-1 outline-none focus:border-orange-400"
                  />
                )}
              </div>
              <button onClick={() => remove(rule.id)} className="text-neutral-300 hover:text-red-500 mt-1 shrink-0">
                <Trash2 size={13} />
              </button>
            </div>
          )
        })}
      </div>

      <button
        onClick={add}
        className="flex items-center gap-1 text-xs text-orange-500 hover:text-orange-700"
      >
        <Plus size={12} /> Add rule
      </button>
    </div>
  )
}
