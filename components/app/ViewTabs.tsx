"use client"

import { useRef, useState } from "react"
import { Plus, List, LayoutGrid, Columns3, MoreHorizontal, GripVertical, Settings } from "lucide-react"
import { toast } from "sonner"
import { useApp } from "@/components/app/AppContext"
import { ConfirmDialog } from "@/components/ui/ConfirmDialog"
import type { View, ViewType } from "@/types/core"
import { cn } from "@/lib/utils"

const VIEW_ICONS: Record<ViewType, React.ReactNode> = {
  grid: <List size={12} />,
  gallery: <LayoutGrid size={12} />,
  kanban: <Columns3 size={12} />,
  calendar: <List size={12} />,
  form: <List size={12} />,
}

interface Props {
  views: View[]
  onViewAdded: (view: View) => void
  onViewRenamed: (id: string, name: string) => void
  onViewDeleted: (id: string) => void
  onViewsReordered: (views: View[]) => void
  onSettingsClick?: () => void
  settingsOpen?: boolean
}

export function ViewTabs({ views, onViewAdded, onViewRenamed, onViewDeleted, onViewsReordered, onSettingsClick, settingsOpen }: Props) {
  const { activeTableId, activeViewId, setActiveViewId } = useApp()
  const [showAddMenu, setShowAddMenu] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editName, setEditName] = useState("")
  const [openMenuId, setOpenMenuId] = useState<string | null>(null)
  const [menuPos, setMenuPos] = useState<{ x: number; y: number }>({ x: 0, y: 0 })
  const [dragOverId, setDragOverId] = useState<string | null>(null)
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)
  const dragIdRef = useRef<string | null>(null)

  const addView = async (type: ViewType) => {
    if (!activeTableId) return
    setShowAddMenu(false)
    const names: Record<ViewType, string> = {
      grid: "Grid", gallery: "Gallery", kanban: "Kanban", calendar: "Calendar", form: "Form",
    }
    const res = await fetch("/api/views", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tableId: activeTableId, type, name: names[type] }),
    })
    if (!res.ok) { toast.error("Failed to add view"); return }
    const view: View = await res.json()
    if (!view?.id) return
    onViewAdded(view)
  }

  const duplicateView = async (view: View) => {
    if (!activeTableId) return
    const res = await fetch("/api/views", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tableId: activeTableId, type: view.type, name: `${view.name} (copy)`, config: view.config }),
    })
    if (!res.ok) { toast.error("Failed to duplicate view"); return }
    const newView: View = await res.json()
    if (!newView?.id) return
    onViewAdded(newView)
    toast.success("View duplicated")
  }

  const commitEdit = (id: string) => {
    const trimmed = editName.trim()
    if (trimmed) onViewRenamed(id, trimmed)
    setEditingId(null)
  }

  const startEdit = (view: View) => {
    setOpenMenuId(null)
    setEditName(view.name)
    setEditingId(view.id)
  }

  // HTML5 drag handlers
  const onDragStart = (e: React.DragEvent, id: string) => {
    dragIdRef.current = id
    e.dataTransfer.effectAllowed = "move"
  }

  const onDragOver = (e: React.DragEvent, id: string) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = "move"
    setDragOverId(id)
  }

  const onDrop = (e: React.DragEvent, targetId: string) => {
    e.preventDefault()
    setDragOverId(null)
    const fromId = dragIdRef.current
    if (!fromId || fromId === targetId) return
    const fromIdx = views.findIndex((v) => v.id === fromId)
    const toIdx = views.findIndex((v) => v.id === targetId)
    const reordered = [...views]
    const [moved] = reordered.splice(fromIdx, 1)
    reordered.splice(toIdx, 0, moved)
    onViewsReordered(reordered)
    reordered.forEach((v, i) => {
      fetch(`/api/views/${v.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ order: i }),
      })
    })
    dragIdRef.current = null
  }

  const onDragEnd = () => {
    setDragOverId(null)
    dragIdRef.current = null
  }

  return (
    <div className="flex items-center border-b bg-white shrink-0 h-9">
      {/* Left: view tabs + add button — scrollable */}
      <div className="flex items-center gap-0.5 px-3 flex-1 overflow-x-auto h-full">
        {views.map((v) => (
        <div
          key={v.id}
          onDragOver={(e) => onDragOver(e, v.id)}
          onDrop={(e) => onDrop(e, v.id)}
          className={cn(
            "group relative flex items-center h-full border-b-2 shrink-0 transition-colors",
            activeViewId === v.id ? "border-blue-500" : "border-transparent",
            dragOverId === v.id && dragIdRef.current !== v.id && "border-blue-300 bg-blue-50/50"
          )}
        >
          {/* Drag grip — only this element is draggable */}
          <div
            draggable
            onDragStart={(e) => onDragStart(e, v.id)}
            onDragEnd={onDragEnd}
            className="opacity-0 group-hover:opacity-100 pl-1 cursor-grab active:cursor-grabbing text-neutral-300 hover:text-neutral-500 transition-opacity shrink-0"
          >
            <GripVertical size={11} />
          </div>

          {editingId === v.id ? (
            <input
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
              onBlur={() => commitEdit(v.id)}
              onKeyDown={(e) => {
                if (e.key === "Enter") commitEdit(v.id)
                if (e.key === "Escape") setEditingId(null)
              }}
              className="text-xs px-2 py-0.5 border rounded outline-none focus:border-blue-400 w-24 mx-1"
              autoFocus
            />
          ) : (
            <button
              onClick={() => setActiveViewId(v.id)}
              onDoubleClick={() => startEdit(v)}
              className={cn(
                "flex items-center gap-1.5 px-2 h-full text-xs transition-colors select-none",
                activeViewId === v.id ? "text-blue-600 font-medium" : "text-neutral-500 hover:text-neutral-700"
              )}
            >
              {VIEW_ICONS[v.type as ViewType]}
              {v.name}
            </button>
          )}

          {/* Context menu */}
          <div className="relative shrink-0">
            <button
              className="opacity-0 group-hover:opacity-100 mr-1 p-0.5 rounded text-neutral-400 hover:text-neutral-600 hover:bg-neutral-100 transition-opacity"
              onClick={(e) => {
                e.stopPropagation()
                const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
                setMenuPos({ x: rect.left, y: rect.bottom + 4 })
                setOpenMenuId(openMenuId === v.id ? null : v.id)
              }}
            >
              <MoreHorizontal size={11} />
            </button>

            {openMenuId === v.id && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setOpenMenuId(null)} />
                <div className="fixed z-50 w-36 rounded-md border bg-white shadow-md py-1" style={{ left: Math.min(menuPos.x, window.innerWidth - 160), top: Math.min(menuPos.y, window.innerHeight - 80) }}>
                  <button
                    className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-neutral-700 hover:bg-neutral-50"
                    onClick={() => startEdit(v)}
                  >
                    Rename
                  </button>
                  <button
                    className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-neutral-700 hover:bg-neutral-50"
                    onClick={() => { setOpenMenuId(null); duplicateView(v) }}
                  >
                    Duplicate
                  </button>
                  {views.length > 1 && (
                    <>
                      <div className="border-t my-1" />
                      <button
                        className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-red-600 hover:bg-red-50"
                        onClick={() => setConfirmDeleteId(v.id)}
                      >
                        Delete
                      </button>
                    </>
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      ))}

        {/* Add view */}
        <div className="relative ml-1 shrink-0">
          <button
            className="flex items-center gap-1 px-2 py-1 text-xs text-neutral-400 hover:text-neutral-600 hover:bg-neutral-100 rounded"
            onClick={(e) => {
              const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
              setMenuPos({ x: rect.left, y: rect.bottom + 4 })
              setShowAddMenu((v) => !v)
            }}
          >
            <Plus size={12} /> Add view
          </button>
          {showAddMenu && (
            <>
              <div className="fixed inset-0 z-40" onClick={() => setShowAddMenu(false)} />
              <div className="fixed z-50 w-36 rounded-md border bg-white shadow-md py-1" style={{ left: Math.min(menuPos.x, window.innerWidth - 160), top: Math.min(menuPos.y, window.innerHeight - 80) }}>
                {(["grid", "gallery", "kanban"] as ViewType[]).map((type) => (
                  <button
                    key={type}
                    className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-neutral-700 hover:bg-neutral-50 capitalize"
                    onClick={() => addView(type)}
                  >
                    {VIEW_ICONS[type]} {type}
                  </button>
                ))}
              </div>
            </>
          )}
        </div>
      </div>

      {/* Right: settings gear icon (Etsy only) */}
      {onSettingsClick && (
        <button
          onClick={onSettingsClick}
          className={cn(
            "shrink-0 flex items-center justify-center w-9 h-full border-l transition-colors",
            settingsOpen
              ? "text-orange-500 bg-orange-50"
              : "text-neutral-400 hover:text-neutral-600 hover:bg-neutral-50"
          )}
          title="Listing Settings"
        >
          <Settings size={14} />
        </button>
      )}

      {confirmDeleteId && (
        <ConfirmDialog
          title="Delete view?"
          description="The view's configuration will be permanently deleted."
          onConfirm={() => { onViewDeleted(confirmDeleteId); setConfirmDeleteId(null); setOpenMenuId(null) }}
          onCancel={() => setConfirmDeleteId(null)}
        />
      )}
    </div>
  )
}
