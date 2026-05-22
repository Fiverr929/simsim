"use client"
import type { FieldRoleConfig } from "@/types/listing-settings"
import type { Field } from "@/types/core"
interface Props { fieldRoles: FieldRoleConfig[]; fields: Field[]; onChange: (roles: FieldRoleConfig[]) => void }
export function FieldRoleTable({ fieldRoles: _fieldRoles, fields: _fields, onChange: _onChange }: Props) {
  return <div className="p-4 text-xs text-neutral-400">Field role configuration — coming in next task</div>
}
