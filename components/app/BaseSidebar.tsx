"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { ChevronRight, ChevronDown, Plus, MoreHorizontal, Table2, Database, Trash2, Pencil, ShoppingBag, Plug, Check } from "lucide-react"
import { toast } from "sonner"
import { ConfirmDialog } from "@/components/ui/ConfirmDialog"
import { EtsyConnectDialog } from "@/components/etsy/EtsyConnectDialog"
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
  const [connectingBaseId, setConnectingBaseId] = useState<string | null>(null)
  const [storeDropdownOpen, setStoreDropdownOpen] = useState(false)
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
  useEffect(() => {
    const handler = () => fetchBases()
    window.addEventListener("etsy:store-updated", handler)
    return () => window.removeEventListener("etsy:store-updated", handler)
  }, [fetchBases])

  const addEtsyStore = async () => {
    if (!activeSpaceId) return
    const res = await fetch("/api/seed/etsy", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ spaceId: activeSpaceId }),
    })
    if (!res.ok) { toast.error("Failed to create Etsy Store"); return }
    const base: BaseWithTables & { firstTableId: string; firstViewId: string | null } = await res.json()
    setBases((prev) => [...prev, { ...base, etsyConnected: false, etsyShopName: null }])
    setExpanded((prev) => new Set([...prev, base.id]))
    setActiveBaseId(base.id)
    setActiveBaseIntegration("etsy")
    if (base.firstTableId) openTable(base.firstTableId, base.firstViewId ?? undefined, base.id)
    setConnectingBaseId(base.id)
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
              {etsyBases.length > 0 && (() => {
                const activeEtsyBase = etsyBases.find((b) => b.id === activeBaseId) ?? etsyBases[0]
                return (
                  <div className="mb-3">
                    {/* Store selector */}
                    <div className="relative mb-1">
                      <button
                        onClick={() => setStoreDropdownOpen((o) => !o)}
                        className={cn(
                          "w-full flex items-center gap-2 px-2.5 py-2 rounded-lg border text-xs font-medium transition-colors",
                          storeDropdownOpen
                            ? "bg-orange-50 border-orange-200 text-orange-700"
                            : "bg-white border-neutral-200 text-neutral-700 hover:border-orange-200 hover:bg-orange-50"
                        )}
                      >
                        <ShoppingBag size={12} className="text-orange-400 shrink-0" />
                        <span className="flex-1 text-left truncate">
                          {activeEtsyBase.etsyConnected && activeEtsyBase.etsyShopName
                            ? activeEtsyBase.etsyShopName
                            : activeEtsyBase.name}
                        </span>
                        {activeEtsyBase.etsyConnected
                          ? <div className="w-1.5 h-1.5 rounded-full bg-green-400 shrink-0" />
                          : <div className="w-1.5 h-1.5 rounded-full bg-orange-300 shrink-0" />}
                        <ChevronDown size={11} className={cn("text-neutral-400 shrink-0 transition-transform", storeDropdownOpen && "rotate-180")} />
                      </button>

                      {storeDropdownOpen && (
                        <>
                          <div className="fixed inset-0 z-40" onClick={() => setStoreDropdownOpen(false)} />
                          <div className="absolute left-0 right-0 top-full mt-1 z-50 bg-white border rounded-lg shadow-lg py-1 overflow-hidden">
                            {etsyBases.map((base) => (
                              <div
                                key={base.id}
                                className="group/item flex items-center gap-2 px-3 py-2 text-xs hover:bg-orange-50 cursor-pointer"
                                onClick={() => {
                                  setStoreDropdownOpen(false)
                                  const firstTable = base.tables[0]
                                  if (firstTable) { openTable(firstTable.id); setActiveBaseId(base.id); setActiveBaseIntegration(base.config?.integration ?? null) }
                                }}
                              >
                                <Check size={11} className={cn("shrink-0", base.id === activeEtsyBase.id ? "text-orange-500" : "text-transparent")} />
                                <span className="flex-1 truncate text-neutral-700">{base.etsyConnected && base.etsyShopName ? base.etsyShopName : base.name}</span>
                                <span
                                  className="opacity-0 group-hover/item:opacity-100 text-[10px] text-neutral-400 hover:text-orange-500 shrink-0 cursor-pointer"
                                  onClick={(e) => { e.stopPropagation(); setStoreDropdownOpen(false); setConnectingBaseId(base.id) }}
                                >
                                  {base.etsyConnected ? "Manage" : "Connect"}
                                </span>
                                <span
                                  className="opacity-0 group-hover/item:opacity-100 p-0.5 text-neutral-300 hover:text-red-500 shrink-0 cursor-pointer rounded"
                                  onClick={(e) => { e.stopPropagation(); setStoreDropdownOpen(false); setConfirmDelete({ type: "base", id: base.id, name: base.etsyShopName ?? base.name }) }}
                                >
                                  <Trash2 size={10} />
                                </span>
                              </div>
                            ))}
                            <div className="border-t mt-1 pt-1">
                              <button
                                className="w-full flex items-center gap-2 px-3 py-2 text-xs text-orange-500 hover:bg-orange-50"
                                onClick={() => { setStoreDropdownOpen(false); addEtsyStore() }}
                              >
                                <Plus size={11} /> Add Etsy Store
                              </button>
                            </div>
                          </div>
                        </>
                      )}
                    </div>

                    {/* Tables for active store */}
                    {activeEtsyBase.tables.map((table) => (
                      <div
                        key={table.id}
                        className={cn(
                          "group flex items-center gap-1.5 rounded-md px-2 py-1 hover:bg-orange-50 cursor-pointer ml-1",
                          activeTableId === table.id && "bg-orange-50"
                        )}
                        onClick={() => { openTable(table.id); setActiveBaseId(activeEtsyBase.id); setActiveBaseIntegration(activeEtsyBase.config?.integration ?? null) }}
                      >
                        <Table2 size={12} className={cn("shrink-0", activeTableId === table.id ? "text-orange-500" : "text-neutral-400")} />
                        <span className={cn("flex-1 text-xs truncate", activeTableId === table.id ? "text-orange-600 font-medium" : "text-neutral-600")}>
                          {table.name}
                        </span>
                      </div>
                    ))}
                  </div>
                )
              })()}

              {/* No Etsy stores yet */}
              {etsyBases.length === 0 && (
                <div className="mb-3 mx-1 rounded-lg border border-dashed border-orange-200 p-4 text-center">
                  <ShoppingBag size={18} className="text-orange-300 mx-auto mb-2" />
                  <p className="text-xs font-medium text-neutral-600 mb-0.5">No Etsy store connected</p>
                  <p className="text-[11px] text-neutral-400 mb-3">Connect your store to start automating listings</p>
                  <button
                    onClick={addEtsyStore}
                    className="px-3 py-1.5 text-xs bg-orange-500 text-white rounded-lg hover:bg-orange-600 font-medium"
                  >
                    Add Etsy Store
                  </button>
                </div>
              )}

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

      {connectingBaseId && (() => {
        const base = bases.find((b) => b.id === connectingBaseId)
        return (
          <EtsyConnectDialog
            baseId={connectingBaseId}
            shopName={base?.etsyShopName}
            onConnected={(shopName) => {
              setBases((prev) => prev.map((b) => b.id === connectingBaseId ? { ...b, etsyConnected: true, etsyShopName: shopName } : b))
              setConnectingBaseId(null)
            }}
            onDisconnected={() => {
              setBases((prev) => prev.map((b) => b.id === connectingBaseId ? { ...b, etsyConnected: false, etsyShopName: null } : b))
              setConnectingBaseId(null)
            }}
            onClose={() => setConnectingBaseId(null)}
          />
        )
      })()}
    </div>
  )
}
