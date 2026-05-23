"use client"

import type { SetFieldAction as SetFieldActionType } from "@/types/automation"
import type { Field } from "@/types/core"

interface Props {
  action: SetFieldActionType
  fields: Field[]
  onChange: (action: SetFieldActionType) => void
}

export function SetFieldAction({ action, fields, onChange }: Props) {
  return (
    <div className="grid grid-cols-2 gap-3">
      <div>
        <label className="text-xs font-medium text-neutral-700 block mb-1">Field</label>
        <select
          value={action.fieldName}
          onChange={(e) => onChange({ ...action, fieldName: e.target.value })}
          className="w-full text-xs border rounded px-2 py-1.5 outline-none focus:border-orange-400"
        >
          <option value="">— select field —</option>
          {fields.map((f) => <option key={f.id} value={f.name}>{f.name}</option>)}
        </select>
      </div>
      <div>
        <label className="text-xs font-medium text-neutral-700 block mb-1">Value</label>
        <input
          value={action.value}
          onChange={(e) => onChange({ ...action, value: e.target.value })}
          className="w-full text-xs border rounded px-2 py-1.5 outline-none focus:border-orange-400"
        />
      </div>
    </div>
  )
}
