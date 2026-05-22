import { useCallback, useEffect, useState } from "react"
import { toast } from "sonner"
import type { AppRecord, CellValue } from "@/types/core"

export function useRecords(tableId: string | null) {
  const [records, setRecords] = useState<AppRecord[]>([])
  const [loading, setLoading] = useState(false)

  const fetchRecords = useCallback(async (id: string) => {
    setLoading(true)
    try {
      const res = await fetch(`/api/records?tableId=${id}`)
      if (res.ok) setRecords(await res.json())
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (tableId) fetchRecords(tableId)
    else setRecords([])
  }, [tableId, fetchRecords])

  const addRecord = useCallback(async (initialData?: Record<string, CellValue>) => {
    if (!tableId) return null
    const res = await fetch("/api/records", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tableId, data: initialData ?? {} }),
    })
    if (!res.ok) { toast.error("Failed to add record"); return null }
    const record: AppRecord = await res.json()
    setRecords((prev) => [...prev, record])
    return record
  }, [tableId])

  const updateRecord = useCallback(async (id: string, data: Record<string, CellValue>) => {
    let prev: AppRecord[] = []
    setRecords((p) => { prev = p; return p.map((r) => r.id === id ? { ...r, data: { ...r.data, ...data } } : r) })
    const res = await fetch(`/api/records/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ data }),
    })
    if (!res.ok) {
      setRecords(prev)
      toast.error("Failed to save record")
    }
  }, [])

  const deleteRecord = useCallback(async (id: string) => {
    let prev: AppRecord[] = []
    setRecords((p) => { prev = p; return p.filter((r) => r.id !== id) })
    const res = await fetch(`/api/records/${id}`, { method: "DELETE" })
    if (!res.ok) {
      setRecords(prev)
      toast.error("Failed to delete record")
      return false
    }
    return true
  }, [])

  const deleteRecords = useCallback(async (ids: string[]) => {
    let prev: AppRecord[] = []
    setRecords((p) => { prev = p; return p.filter((r) => !ids.includes(r.id)) })
    const res = await fetch("/api/records/batch", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ids }),
    })
    if (!res.ok) {
      setRecords(prev)
      toast.error("Failed to delete records")
    }
  }, [])

  const patchLocalRecord = useCallback((id: string, data: Record<string, CellValue>) => {
    setRecords((p) => p.map((r) => r.id === id ? { ...r, data: { ...r.data, ...data } } : r))
  }, [])

  return { records, loading, addRecord, updateRecord, deleteRecord, deleteRecords, patchLocalRecord, refetch: () => tableId && fetchRecords(tableId) }
}
