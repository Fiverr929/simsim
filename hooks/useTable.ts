import { useCallback, useEffect, useState } from "react"
import { toast } from "sonner"
import type { AppTable, FieldConfig, FieldType } from "@/types/core"

export function useTable(tableId: string | null) {
  const [table, setTable] = useState<AppTable | null>(null)
  const [loading, setLoading] = useState(false)

  const fetchTable = useCallback(async (id: string) => {
    setLoading(true)
    try {
      const res = await fetch(`/api/tables/${id}`)
      if (res.ok) setTable(await res.json())
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (tableId) fetchTable(tableId)
    else setTable(null)
  }, [tableId, fetchTable])

  const refetch = useCallback(() => {
    if (tableId) fetchTable(tableId)
  }, [tableId, fetchTable])

  const addField = useCallback(async (name: string, type: FieldType) => {
    if (!tableId) return
    const res = await fetch("/api/fields", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tableId, name, type }),
    })
    if (!res.ok) { toast.error("Failed to add field"); return }
    toast.success("Field added")
    await fetchTable(tableId)
  }, [tableId, fetchTable])

  const updateField = useCallback(async (fieldId: string, data: { name?: string; type?: FieldType; config?: FieldConfig }) => {
    const res = await fetch(`/api/fields/${fieldId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    })
    if (!res.ok) { toast.error("Failed to update field"); return }
    if (tableId) await fetchTable(tableId)
  }, [tableId, fetchTable])

  const deleteField = useCallback(async (fieldId: string) => {
    const res = await fetch(`/api/fields/${fieldId}`, { method: "DELETE" })
    if (!res.ok) { toast.error("Failed to delete field"); return false }
    toast.success("Field deleted")
    if (tableId) await fetchTable(tableId)
    return true
  }, [tableId, fetchTable])

  const deleteFields = useCallback(async (fieldIds: string[]) => {
    // Optimistic: remove fields from local state immediately
    setTable((prev) => {
      if (!prev) return prev
      return { ...prev, fields: prev.fields.filter((f) => !fieldIds.includes(f.id)) }
    })
    const res = await fetch("/api/fields/batch", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ids: fieldIds }),
    })
    if (!res.ok) {
      toast.error("Failed to delete fields")
      if (tableId) await fetchTable(tableId)
      return
    }
    toast.success(`${fieldIds.length} field${fieldIds.length > 1 ? "s" : ""} deleted`)
  }, [tableId, fetchTable])

  return { table, loading, refetch, addField, updateField, deleteField, deleteFields }
}
