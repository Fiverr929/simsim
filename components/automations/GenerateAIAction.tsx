"use client"

import { useState } from "react"
import { Info } from "lucide-react"
import type { GenerateAIAction as GenerateAIActionType } from "@/types/automation"
import type { Field } from "@/types/core"
import { DEFAULT_GENERATE_PROMPT } from "@/types/automation"

interface Props {
  action: GenerateAIActionType
  fields: Field[]
  onChange: (action: GenerateAIActionType) => void
}

export function GenerateAIAction({ action, fields, onChange }: Props) {
  const [showVars, setShowVars] = useState(false)

  const generatableFields = fields.filter((f) =>
    ["text", "longText", "multiSelect"].includes(f.type)
  )

  return (
    <div className="space-y-3">
      <div>
        <div className="flex items-center justify-between mb-1">
          <label className="text-xs font-medium text-neutral-700">AI Prompt</label>
          <button
            onClick={() => setShowVars((v) => !v)}
            className="flex items-center gap-1 text-[11px] text-orange-500 hover:text-orange-700"
          >
            <Info size={11} /> {"{{FieldName}}"}
          </button>
        </div>
        {showVars && (
          <div className="mb-2 p-2 rounded bg-orange-50 border border-orange-100 text-[11px] text-neutral-500 space-y-0.5">
            <p>Use <code className="text-orange-600 font-mono">{"{{FieldName}}"}</code> to insert any column value into your prompt.</p>
            <p>Available: {fields.map((f) => <code key={f.id} className="text-orange-600 font-mono mr-1">{`{{${f.name}}}`}</code>)}</p>
          </div>
        )}
        <textarea
          value={action.prompt}
          onChange={(e) => onChange({ ...action, prompt: e.target.value })}
          rows={8}
          placeholder={DEFAULT_GENERATE_PROMPT}
          className="w-full text-xs border rounded px-3 py-2 outline-none focus:border-orange-400 font-mono resize-y"
        />
      </div>

      <div>
        <label className="text-xs font-medium text-neutral-700 block mb-1">Write results to</label>
        <div className="flex flex-wrap gap-1.5">
          {generatableFields.map((f) => {
            const selected = action.writeToFields.includes(f.name)
            return (
              <button
                key={f.id}
                onClick={() => {
                  const next = selected
                    ? action.writeToFields.filter((n) => n !== f.name)
                    : [...action.writeToFields, f.name]
                  onChange({ ...action, writeToFields: next })
                }}
                className={`px-2 py-0.5 rounded-full border text-[11px] transition-colors ${
                  selected
                    ? "bg-orange-100 border-orange-300 text-orange-700"
                    : "bg-white border-neutral-200 text-neutral-500 hover:border-neutral-300"
                }`}
              >
                {f.name}
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}
