"use client"

import { useEffect, useState } from "react"
import { cn } from "@/lib/utils"
import type { FieldRole, FieldRoleConfig } from "@/types/listing-settings"
import type { Field } from "@/types/core"

const ROLES: FieldRole[] = ["trigger", "context", "generated", "default", "manual", "hidden"]

const ROLE_LABELS: Record<FieldRole, string> = {
  trigger:   "Trigger",
  context:   "Context",
  generated: "Generated",
  default:   "Default",
  manual:    "Manual",
  hidden:    "Hidden",
}

const ROLE_COLORS: Record<FieldRole, string> = {
  trigger:   "bg-red-50 text-red-600 border-red-200",
  context:   "bg-blue-50 text-blue-600 border-blue-200",
  generated: "bg-purple-50 text-purple-600 border-purple-200",
  default:   "bg-neutral-100 text-neutral-600 border-neutral-200",
  manual:    "bg-green-50 text-green-600 border-green-200",
  hidden:    "bg-neutral-50 text-neutral-400 border-neutral-100",
}

interface Props {
  fieldRoles: FieldRoleConfig[]
  fields: Field[]
  onChange: (roles: FieldRoleConfig[]) => void
}

export function FieldRoleTable({ fieldRoles, fields, onChange }: Props) {
  const [rows, setRows] = useState<FieldRoleConfig[]>(() => {
    const existing = Object.fromEntries(fieldRoles.map((r) => [r.fieldName, r]))
    return fields.map((f) => existing[f.name] ?? { fieldName: f.name, roles: ["manual"] })
  })

  useEffect(() => {
    const existing = Object.fromEntries(fieldRoles.map((r) => [r.fieldName, r]))
    setRows(fields.map((f) => existing[f.name] ?? { fieldName: f.name, roles: ["manual"] }))
  }, [fieldRoles, fields])

  const updateRow = (fieldName: string, patch: Partial<FieldRoleConfig>) => {
    const updated = rows.map((r) => r.fieldName === fieldName ? { ...r, ...patch } : r)
    setRows(updated)
    onChange(updated)
  }

  const toggleRole = (fieldName: string, role: FieldRole) => {
    const row = rows.find((r) => r.fieldName === fieldName)!
    let roles: FieldRole[]
    if (row.roles.includes(role)) {
      roles = row.roles.filter((r) => r !== role)
    } else {
      roles = [...row.roles, role]
    }
    if (roles.length === 0) roles = ["manual"]
    updateRow(fieldName, { roles })
  }

  return (
    <div className="space-y-2">
      <p className="text-xs text-neutral-500 mb-3">
        Assign roles to each field. <strong>Trigger</strong> starts the automation.{" "}
        <strong>Context</strong> means the user provides a hint and AI generates from it.{" "}
        <strong>Generated</strong> means AI creates it from scratch.{" "}
        <strong>Default</strong> means a static value is pre-filled silently.{" "}
        <strong>Manual</strong> = user always fills it. <strong>Hidden</strong> = system-managed.
      </p>

      <div className="rounded-lg border overflow-hidden">
        <table className="w-full text-xs">
          <thead>
            <tr className="bg-neutral-50 border-b">
              <th className="text-left px-3 py-2 text-neutral-600 font-medium w-40">Field</th>
              <th className="text-left px-3 py-2 text-neutral-600 font-medium">Roles</th>
              <th className="text-left px-3 py-2 text-neutral-600 font-medium w-36">Default / Hint</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => (
              <tr key={row.fieldName} className={cn("border-b last:border-0", i % 2 === 0 ? "bg-white" : "bg-neutral-50/50")}>
                <td className="px-3 py-2 font-medium text-neutral-700">{row.fieldName}</td>
                <td className="px-3 py-2">
                  <div className="flex flex-wrap gap-1">
                    {ROLES.map((role) => (
                      <button
                        key={role}
                        onClick={() => toggleRole(row.fieldName, role)}
                        className={cn(
                          "px-1.5 py-0.5 rounded border text-[11px] transition-all",
                          row.roles.includes(role)
                            ? ROLE_COLORS[role]
                            : "bg-white text-neutral-300 border-neutral-200 hover:border-neutral-300 hover:text-neutral-500"
                        )}
                      >
                        {ROLE_LABELS[role]}
                      </button>
                    ))}
                  </div>
                </td>
                <td className="px-3 py-2">
                  {row.roles.includes("default") && (
                    <input
                      type="text"
                      value={String(row.defaultValue ?? "")}
                      onChange={(e) => updateRow(row.fieldName, { defaultValue: e.target.value })}
                      placeholder="default value"
                      className="w-full text-[11px] border rounded px-1.5 py-0.5 outline-none focus:border-orange-400"
                    />
                  )}
                  {row.roles.includes("context") && (
                    <input
                      type="text"
                      value={row.contextHint ?? ""}
                      onChange={(e) => updateRow(row.fieldName, { contextHint: e.target.value })}
                      placeholder="hint shown in grid"
                      className="w-full text-[11px] border rounded px-1.5 py-0.5 outline-none focus:border-orange-400 mt-1"
                    />
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
