"use client"

import type { TriggerCondition, TriggerType } from "@/types/listing-settings"

const TRIGGER_TYPES: Array<{ value: TriggerType; label: string; hasFields: boolean; hasStatus: boolean }> = [
  { value: "field_filled",  label: "When a field is filled",          hasFields: true,  hasStatus: false },
  { value: "fields_filled", label: "When multiple fields are filled", hasFields: true,  hasStatus: false },
  { value: "status_equals", label: "When Status equals a value",      hasFields: false, hasStatus: true  },
  { value: "row_created",   label: "When a row is created",           hasFields: false, hasStatus: false },
  { value: "manual",        label: "Manual only (Run button)",        hasFields: false, hasStatus: false },
]

const COMMON_FIELD_NAMES = ["Images", "Title", "Description", "Price", "Tags"]

interface Props {
  trigger: TriggerCondition
  onChange: (trigger: TriggerCondition) => void
}

export function TriggerConfig({ trigger, onChange }: Props) {
  const meta = TRIGGER_TYPES.find((t) => t.value === trigger.type)!

  return (
    <div className="space-y-3">
      <div>
        <label className="text-xs font-medium text-neutral-700 block mb-1">Trigger condition</label>
        <select
          value={trigger.type}
          onChange={(e) => onChange({ type: e.target.value as TriggerType })}
          className="w-full text-xs border rounded px-2 py-1.5 outline-none focus:border-orange-400"
        >
          {TRIGGER_TYPES.map((t) => (
            <option key={t.value} value={t.value}>{t.label}</option>
          ))}
        </select>
      </div>

      {meta.hasFields && (
        <div>
          <label className="text-xs font-medium text-neutral-700 block mb-1">
            {trigger.type === "fields_filled" ? "Fields (all must be filled)" : "Field"}
          </label>
          <div className="space-y-1">
            {(trigger.fieldNames ?? ["Images"]).map((name, i) => (
              <div key={i} className="flex items-center gap-2">
                <select
                  value={name}
                  onChange={(e) => {
                    const names = [...(trigger.fieldNames ?? [])]
                    names[i] = e.target.value
                    onChange({ ...trigger, fieldNames: names })
                  }}
                  className="flex-1 text-xs border rounded px-2 py-1 outline-none focus:border-orange-400"
                >
                  {COMMON_FIELD_NAMES.map((f) => <option key={f} value={f}>{f}</option>)}
                </select>
                {trigger.type === "fields_filled" && (
                  <button
                    onClick={() => onChange({ ...trigger, fieldNames: (trigger.fieldNames ?? []).filter((_, idx) => idx !== i) })}
                    className="text-neutral-300 hover:text-red-500 text-xs"
                  >✕</button>
                )}
              </div>
            ))}
            {trigger.type === "fields_filled" && (
              <button
                onClick={() => onChange({ ...trigger, fieldNames: [...(trigger.fieldNames ?? []), "Images"] })}
                className="text-xs text-orange-500 hover:text-orange-700"
              >
                + Add field
              </button>
            )}
          </div>
        </div>
      )}

      {meta.hasStatus && (
        <div>
          <label className="text-xs font-medium text-neutral-700 block mb-1">Status value</label>
          <input
            value={trigger.statusValue ?? ""}
            onChange={(e) => onChange({ ...trigger, statusValue: e.target.value })}
            placeholder="e.g. Ready to Generate"
            className="w-full text-xs border rounded px-2 py-1.5 outline-none focus:border-orange-400"
          />
        </div>
      )}
    </div>
  )
}
