"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { ChevronDown, Plus, Check, MoreHorizontal, Pencil, Trash2, FolderOpen } from "lucide-react"
import { toast } from "sonner"
import { useApp } from "@/components/app/AppContext"
import { ConfirmDialog } from "@/components/ui/ConfirmDialog"
import type { Space } from "@/types/core"
import { cn } from "@/lib/utils"

export function TopNav() {
  const { activeSpaceId, setActiveSpaceId, setActiveBaseId, setActiveTableId, setActiveViewId } = useApp()
  const [spaces, setSpaces] = useState<Space[]>([])
  const [open, setOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [spaceMenuId, setSpaceMenuId] = useState<string | null>(null)
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)
  const ref = useRef<HTMLDivElement>(null)

  const fetchSpaces = useCallback(async () => {
    const res = await fetch("/api/spaces")
    const data: Space[] = await res.json()
    setSpaces(data)
    if (data.length > 0 && !activeSpaceId) setActiveSpaceId(data[0].id)
  }, [activeSpaceId, setActiveSpaceId])

  useEffect(() => { fetchSpaces() }, [fetchSpaces])

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false)
        setSpaceMenuId(null)
      }
    }
    document.addEventListener("mousedown", handler)
    return () => document.removeEventListener("mousedown", handler)
  }, [])

  const activeSpace = spaces.find((s) => s.id === activeSpaceId)

  const createSpace = async () => {
    const res = await fetch("/api/spaces", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "New Space" }),
    })
    if (!res.ok) { toast.error("Failed to create space"); return }
    const space: Space = await res.json()
    setSpaces((prev) => [...prev, space])
    setEditingId(space.id)
  }

  const renameSpace = async (id: string, name: string) => {
    setEditingId(null)
    const trimmed = name.trim() || "Untitled"
    setSpaces((prev) => prev.map((s) => (s.id === id ? { ...s, name: trimmed } : s)))
    const res = await fetch(`/api/spaces/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: trimmed }),
    })
    if (!res.ok) toast.error("Failed to rename space")
  }

  const deleteSpace = async (id: string) => {
    setConfirmDeleteId(null)
    setSpaceMenuId(null)
    setOpen(false)
    const remaining = spaces.filter((s) => s.id !== id)
    setSpaces(remaining)
    if (activeSpaceId === id) {
      setActiveSpaceId(remaining[0]?.id ?? null)
      setActiveBaseId(null)
      setActiveTableId(null)
      setActiveViewId(null)
    }
    const res = await fetch(`/api/spaces/${id}`, { method: "DELETE" })
    if (!res.ok) toast.error("Failed to delete space")
    else toast.success("Space deleted")
  }

  const switchSpace = (id: string) => {
    setActiveSpaceId(id)
    setActiveBaseId(null)
    setActiveTableId(null)
    setActiveViewId(null)
    setOpen(false)
  }

  return (
    <div className="h-10 flex items-center px-3 border-b bg-white shrink-0 gap-2">
      <div ref={ref} className="relative">
        <button
          className="flex items-center gap-1.5 text-sm font-medium text-neutral-700 hover:text-neutral-900 px-2 py-1 rounded hover:bg-neutral-100"
          onClick={() => setOpen((v) => !v)}
        >
          <FolderOpen size={15} className="text-neutral-400 shrink-0" />
          <span>{activeSpace?.name ?? "Select space…"}</span>
          <ChevronDown size={13} className="text-neutral-400" />
        </button>

        {open && (
          <div className="absolute left-0 top-full mt-1 z-50 w-60 rounded-lg border bg-white shadow-lg py-1">
            <p className="px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-neutral-400">Spaces</p>
            {spaces.map((s) => (
              <div key={s.id} className="relative group">
                {editingId === s.id ? (
                  <input
                    autoFocus
                    defaultValue={s.name}
                    className="w-full text-sm px-3 py-1.5 outline-none border-b border-blue-300 bg-blue-50"
                    onBlur={(e) => renameSpace(s.id, e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") renameSpace(s.id, e.currentTarget.value)
                      if (e.key === "Escape") setEditingId(null)
                    }}
                  />
                ) : (
                  <div className="flex items-center">
                    <button
                      className="flex-1 flex items-center gap-2 px-3 py-1.5 text-sm text-neutral-700 hover:bg-neutral-50 text-left"
                      onClick={() => switchSpace(s.id)}
                    >
                      <FolderOpen size={15} className="text-neutral-400 shrink-0" />
                      <span className="flex-1 truncate">{s.name}</span>
                      {s.id === activeSpaceId && <Check size={13} className="text-blue-500 shrink-0" />}
                    </button>
                    <button
                      className="opacity-0 group-hover:opacity-100 px-2 py-1.5 text-neutral-400 hover:text-neutral-700 transition-opacity"
                      onClick={(e) => { e.stopPropagation(); setSpaceMenuId(spaceMenuId === s.id ? null : s.id) }}
                    >
                      <MoreHorizontal size={13} />
                    </button>
                  </div>
                )}

                {spaceMenuId === s.id && (
                  <>
                    <div className="fixed inset-0 z-[60]" onClick={() => setSpaceMenuId(null)} />
                    <div className="absolute right-0 top-full mt-0.5 z-[70] w-36 rounded-md border bg-white shadow-md py-1">
                      <button
                        className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-neutral-700 hover:bg-neutral-50"
                        onClick={() => { setSpaceMenuId(null); setEditingId(s.id) }}
                      >
                        <Pencil size={11} /> Rename
                      </button>
                      <button
                        className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-red-600 hover:bg-red-50"
                        onClick={() => setConfirmDeleteId(s.id)}
                      >
                        <Trash2 size={11} /> Delete space
                      </button>
                    </div>
                  </>
                )}
              </div>
            ))}
            <div className="border-t mt-1 pt-1">
              <button
                className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-neutral-500 hover:bg-neutral-50"
                onClick={createSpace}
              >
                <Plus size={12} /> New space
              </button>
            </div>
          </div>
        )}
      </div>

      {confirmDeleteId && (
        <ConfirmDialog
          title="Delete space?"
          description="This will permanently delete the space and all bases, tables, and records inside it."
          onConfirm={() => deleteSpace(confirmDeleteId)}
          onCancel={() => setConfirmDeleteId(null)}
        />
      )}
    </div>
  )
}
