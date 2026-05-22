"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { ChevronRight, ChevronDown, Plus, MoreHorizontal, Table2, Database, Trash2, Pencil, ShoppingBag } from "lucide-react"
import { toast } from "sonner"
import { ConfirmDialog } from "@/components/ui/ConfirmDialog"
import { useApp } from "@/components/app/AppContext"
import type { Base, AppTable, BaseConfig } from "@/types/core"
import { cn } from "@/lib/utils"

interface BaseWithTables extends Omit<Base, "tables"> {
  config: BaseConfig
  tables: Pick<AppTable, "id" | "name" | "order" | "baseId">[]
}

export function BaseSidebar() {
  const { activeSpaceId, activeTableId, activeBaseId, openTable, setActiveBaseId, setActiveTableId, setActiveViewId, setActiveBaseIntegration } = useApp()
  const [bases, setBases] = useState<BaseWithTables[]>([])
  const [expanded, setExpanded] = useState<Set<string>>(new Set())
  const [menuId, setMenuId] = useState<string | null>(null)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [tableEditingId, setTableEditingId] = useState<string | null>(null)
  const [tableEditName, setTableEditName] = useState("")
  const [confirmDelete, setConfirmDelete] = useState<{ type: "base" | "table"; id: string; baseId?: string; name: string } | null>(null)
  const editRef = useRef<HTMLInputElement>(null)

  const fetchBases = useCallback(async () => {
    if (!activeSpaceId) return
    const res = await fetch(`/api/bases?spaceId=${activeSpaceId}`)
    if (!res.ok) return
    const data: BaseWithTables[] = await res.json()
    if (!Array.isArray(data)) return
    setBases(data)
    if (data.length > 0) setExpanded(new Set([data[0].id]))
  }, [activeSpaceId])

  useEffect(() => { fetchBases() }, [fetchBases])
  useEffect(() => { if (editingId && editRef.current) editRef.current.focus() }, [editingId])

  const addBase = async () => {
    if (!activeSpaceId) return
    const res = await fetch("/api/bases", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "New Base", spaceId: activeSpaceId }),
    })
    if (!res.ok) { toast.error("Failed to create base"); return }
    const base: BaseWithTables = await res.json()
    setBases((prev) => [...prev, base])
    setExpanded((prev) => new Set([...prev, base.id]))
    setEditingId(base.id)
  }

  const addNewListingRow = (base: BaseWithTables) => {
    const digitalTable = base.tables.find((t) => t.name === "Digital Listings") ?? base.tables[0]
    if (!digitalTable) return
    openTable(digitalTable.id, undefined, base.id)
    setActiveBaseIntegration(base.config?.integration ?? null)
    window.dispatchEvent(new CustomEvent("etsy:new-listing", { detail: { tableId: digitalTable.id } }))
  }

  const addEtsyStore = async () => {
    if (!activeSpaceId) return
    const res = await fetch("/api/seed/etsy", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ spaceId: activeSpaceId }),
    })
    if (!res.ok) { toast.error("Failed to create Etsy Store"); return }
    const base: BaseWithTables & { firstTableId: string; firstViewId: string | null } = await res.json()
    setBases((prev) => [...prev, base])
    setExpanded((prev) => new Set([...prev, base.id]))
    setActiveBaseId(base.id)
    setActiveBaseIntegration("etsy")
    if (base.firstTableId) openTable(base.firstTableId, base.firstViewId ?? undefined, base.id)
  }

  const renameBase = async (id: string, name: string) => {
    setEditingId(null)
    const trimmed = name.trim() || "Untitled"
    setBases((prev) => prev.map((b) => (b.id === id ? { ...b, name: trimmed } : b)))
    const res = await fetch(`/api/bases/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: trimmed }),
    })
    if (!res.ok) toast.error("Failed to rename base")
  }

  const deleteBase = async (id: string) => {
    setBases((prev) => prev.filter((b) => b.id !== id))
    if (activeBaseId === id) setActiveBaseId(null)
    if (activeTableId && bases.find((b) => b.id === id)?.tables.some((t) => t.id === activeTableId)) {
      setActiveTableId(null)
      setActiveViewId(null)
    }
    const res = await fetch(`/api/bases/${id}`, { method: "DELETE" })
    if (!res.ok) toast.error("Failed to delete base")
    else toast.success("Base deleted")
  }

  const addTable = async (baseId: string) => {
    const res = await fetch("/api/tables", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "Table", baseId }),
    })
    if (!res.ok) { toast.error("Failed to create table"); return }
    const table = await res.json()
    setBases((prev) =>
      prev.map((b) => b.id === baseId ? { ...b, tables: [...b.tables, table] } : b)
    )
    openTable(table.id, table.views?.[0]?.id, baseId)
  }

  const renameTable = async (baseId: string, tableId: string, name: string) => {
    setTableEditingId(null)
    const trimmed = name.trim() || "Untitled"
    setBases((prev) =>
      prev.map((b) =>
        b.id === baseId
          ? { ...b, tables: b.tables.map((t) => t.id === tableId ? { ...t, name: trimmed } : t) }
          : b
      )
    )
    const res = await fetch(`/api/tables/${tableId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: trimmed }),
    })
    if (!res.ok) toast.error("Failed to rename table")
  }

  const deleteTable = async (baseId: string, tableId: string) => {
    setMenuId(null)
    let nextTableId: string | null = null
    setBases((prev) => {
      const next = prev.map((b) => {
        if (b.id !== baseId) return b
        const remaining = b.tables.filter((t) => t.id !== tableId)
        if (activeTableId === tableId) nextTableId = remaining[0]?.id ?? null
        return { ...b, tables: remaining }
      })
      return next
    })
    if (activeTableId === tableId) {
      setActiveTableId(nextTableId)
      setActiveViewId(null)
    }
    const res = await fetch(`/api/tables/${tableId}`, { method: "DELETE" })
    if (!res.ok) toast.error("Failed to delete table")
    else toast.success("Table deleted")
  }

  const toggleBase = (id: string) => {
    setExpanded((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  if (!activeSpaceId) return (
    <div className="flex-1 flex flex-col items-center justify-center gap-3 p-4 text-center">
      <div className="w-10 h-10 rounded-xl bg-neutral-100 flex items-center justify-center text-lg select-none">
        <Database size={20} className="text-neutral-300" />
      </div>
      <p className="text-xs text-neutral-400 leading-relaxed">Select a space<br />to see your bases</p>
    </div>
  )

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="flex-1 overflow-y-auto p-2 space-y-1">
        {/* Derive split lists */}
        {(() => {
          const etsyBases = bases.filter((b) => b.config?.integration === "etsy")
          const genericBases = bases.filter((b) => b.config?.integration !== "etsy")
          return (
            <>
              {/* Etsy Store section */}
              {etsyBases.map((base) => (
                <div key={base.id} className="mb-3">
                  <div className="flex items-center gap-1.5 px-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-neutral-400 select-none">
                    <ShoppingBag size={10} />
                    {base.name}
                  </div>
                  {base.tables.map((table) => (
                    <div
                      key={table.id}
                      className={cn(
                        "group flex items-center gap-1.5 rounded-md px-2 py-1 hover:bg-orange-50 cursor-pointer ml-1",
                        activeTableId === table.id && "bg-orange-50"
                      )}
                      onClick={() => { openTable(table.id); setActiveBaseId(base.id); setActiveBaseIntegration(base.config?.integration ?? null) }}
                    >
                      <Table2 size={12} className={cn("shrink-0", activeTableId === table.id ? "text-orange-500" : "text-neutral-400")} />
                      <span className={cn("flex-1 text-xs truncate", activeTableId === table.id ? "text-orange-600 font-medium" : "text-neutral-600")}>
                        {table.name}
                      </span>
                    </div>
                  ))}
                  <button
                    className="flex items-center gap-1.5 ml-1 px-2 py-1 text-xs text-orange-500 hover:bg-orange-50 rounded-md w-full"
                    onClick={() => addNewListingRow(base)}
                  >
                    <Plus size={11} /> New Listing
                  </button>
                </div>
              ))}

              {/* Divider between Etsy and generic */}
              {etsyBases.length > 0 && genericBases.length > 0 && (
                <div className="border-t my-2 mx-2" />
              )}

              {/* Generic bases */}
              {genericBases.map((base) => (
                <div key={base.id}>
                  <div className={cn("group flex items-center gap-1 rounded-md px-1 py-1 hover:bg-neutral-100 relative", activeBaseId === base.id && "bg-blue-50")}>
                    <button onClick={() => toggleBase(base.id)} className="p-0.5 text-neutral-400">
                      {expanded.has(base.id) ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
                    </button>
                    <Database size={14} className="text-neutral-400 shrink-0" />
                    {editingId === base.id ? (
                      <input
                        ref={editRef}
                        defaultValue={base.name}
                        className="flex-1 text-xs outline-none bg-transparent"
                        onBlur={(e) => renameBase(base.id, e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") renameBase(base.id, e.currentTarget.value)
                          if (e.key === "Escape") setEditingId(null)
                        }}
                      />
                    ) : (
                      <span className="flex-1 text-xs font-semibold text-neutral-700 truncate">{base.name}</span>
                    )}
                    <button
                      className="opacity-0 group-hover:opacity-100 p-0.5 text-neutral-400 hover:text-neutral-700 rounded"
                      onClick={(e) => { e.stopPropagation(); setMenuId(menuId === base.id ? null : base.id) }}
                    >
                      <MoreHorizontal size={12} />
                    </button>

                    {menuId === base.id && (
                      <>
                        <div className="fixed inset-0 z-40" onClick={() => setMenuId(null)} />
                        <div className="absolute right-0 top-full mt-0.5 z-50 w-36 rounded-md border bg-white shadow-md py-1">
                          <button className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-neutral-700 hover:bg-neutral-50"
                            onClick={() => { setMenuId(null); setEditingId(base.id) }}>
                            <Pencil size={11} /> Rename
                          </button>
                          <button className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-red-600 hover:bg-red-50"
                            onClick={() => { setMenuId(null); setConfirmDelete({ type: "base", id: base.id, name: base.name }) }}>
                            <Trash2 size={11} /> Delete base
                          </button>
                        </div>
                      </>
                    )}
                  </div>

                  {expanded.has(base.id) && (
                    <div className="ml-5 space-y-0.5">
                      {base.tables.map((table) => (
                        <div
                          key={table.id}
                          className="group flex items-center gap-1.5 rounded-md px-2 py-1 hover:bg-neutral-100 relative cursor-pointer"
                          onClick={() => { openTable(table.id); setActiveBaseId(base.id); setActiveBaseIntegration(base.config?.integration ?? null) }}
                        >
                          <Table2 size={12} className={cn("shrink-0", activeTableId === table.id ? "text-blue-500" : "text-neutral-400")} />
                          {tableEditingId === table.id ? (
                            <input
                              autoFocus
                              value={tableEditName}
                              onChange={(e) => setTableEditName(e.target.value)}
                              className="flex-1 text-xs outline-none bg-transparent"
                              onBlur={() => renameTable(base.id, table.id, tableEditName)}
                              onKeyDown={(e) => {
                                if (e.key === "Enter") renameTable(base.id, table.id, tableEditName)
                                if (e.key === "Escape") setTableEditingId(null)
                              }}
                              onClick={(e) => e.stopPropagation()}
                            />
                          ) : (
                            <span
                              className={cn("flex-1 text-xs truncate", activeTableId === table.id ? "text-blue-600 font-medium" : "text-neutral-600")}
                              onDoubleClick={(e) => {
                                e.stopPropagation()
                                setTableEditName(table.name)
                                setTableEditingId(table.id)
                              }}
                            >
                              {table.name}
                            </span>
                          )}
                          <button
                            className="opacity-0 group-hover:opacity-100 p-0.5 text-neutral-400 hover:text-red-500 rounded"
                            onClick={(e) => { e.stopPropagation(); setConfirmDelete({ type: "table", id: table.id, baseId: base.id, name: table.name }) }}
                            title="Delete table"
                          >
                            <Trash2 size={10} />
                          </button>
                        </div>
                      ))}
                      <button
                        className="flex items-center gap-1.5 px-2 py-1 text-xs text-neutral-400 hover:text-neutral-600 w-full rounded hover:bg-neutral-100"
                        onClick={() => addTable(base.id)}
                      >
                        <Plus size={11} /> Add table
                      </button>
                    </div>
                  )}
                </div>
              ))}

              {bases.length === 0 && (
                <div className="text-xs text-neutral-400 px-2 py-4 text-center">
                  No bases yet — add one below
                </div>
              )}
            </>
          )
        })()}
      </div>

      <div className="p-2 border-t shrink-0 space-y-0.5">
        <button
          className="flex items-center gap-1.5 w-full px-2 py-1.5 text-xs text-neutral-500 hover:bg-neutral-100 rounded-md"
          onClick={addBase}
        >
          <Plus size={12} /> <Database size={12} /> Add base
        </button>
        <button
          className="flex items-center gap-1.5 w-full px-2 py-1.5 text-xs text-orange-500 hover:bg-orange-50 rounded-md"
          onClick={addEtsyStore}
        >
          <ShoppingBag size={12} /> New Etsy Store
        </button>
      </div>

      {confirmDelete && (
        <ConfirmDialog
          title={`Delete ${confirmDelete.type === "base" ? "base" : "table"}?`}
          description={`"${confirmDelete.name}" and all its data will be permanently deleted.`}
          onConfirm={() => {
            if (confirmDelete.type === "base") deleteBase(confirmDelete.id)
            else if (confirmDelete.baseId) deleteTable(confirmDelete.baseId, confirmDelete.id)
            setConfirmDelete(null)
          }}
          onCancel={() => setConfirmDelete(null)}
        />
      )}
    </div>
  )
}
