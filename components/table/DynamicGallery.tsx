"use client"

import { useState } from "react"
import { Image } from "lucide-react"
import type { AppRecord, Field } from "@/types/core"
import { cn } from "@/lib/utils"

interface Props {
  fields: Field[]
  records: AppRecord[]
  coverFieldId?: string
  onExpand: (record: AppRecord) => void
  onContextMenu: (record: AppRecord, x: number, y: number) => void
  onCoverFieldChange?: (fieldId: string | undefined) => void
}

function isImageUrl(value: unknown): value is string {
  if (typeof value !== "string" || !value) return false
  try {
    const url = new URL(value)
    return /\.(jpe?g|png|gif|webp|avif|svg)(\?.*)?$/i.test(url.pathname) || url.hostname.includes("unsplash") || url.hostname.includes("imgur") || url.hostname.includes("cloudinary")
  } catch {
    return false
  }
}

export function DynamicGallery({ fields, records, coverFieldId, onExpand, onContextMenu, onCoverFieldChange }: Props) {
  const [showCoverPicker, setShowCoverPicker] = useState(false)
  const primaryField = fields.find((f) => f.isPrimary) ?? fields[0]
  const secondaryFields = fields.filter((f) => !f.isPrimary && f.id !== coverFieldId).slice(0, 4)
  const coverFields = fields.filter((f) => f.type === "attachment" || f.type === "url")
  const coverField = fields.find((f) => f.id === coverFieldId)

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Cover picker toolbar */}
      {onCoverFieldChange && (
        <div className="flex items-center gap-2 px-4 py-2 border-b bg-white shrink-0 relative">
          <button
            onClick={() => setShowCoverPicker((v) => !v)}
            className={cn(
              "flex items-center gap-1.5 px-2.5 py-1 text-xs rounded transition-colors",
              coverField ? "text-blue-600 bg-blue-50 hover:bg-blue-100" : "text-neutral-600 hover:bg-neutral-100"
            )}
          >
            <Image size={13} />
            {coverField ? `Cover: ${coverField.name}` : "Cover field"}
          </button>
          {showCoverPicker && (
            <>
              <div className="fixed inset-0 z-40" onClick={() => setShowCoverPicker(false)} />
              <div className="absolute left-4 top-full mt-1 z-50 w-48 rounded-lg border bg-white shadow-lg py-1">
                <p className="px-3 py-1 text-[10px] font-semibold uppercase tracking-wider text-neutral-400">Cover field</p>
                <button
                  className={cn("w-full flex items-center px-3 py-1.5 text-xs hover:bg-neutral-50", !coverFieldId ? "text-blue-600 font-medium" : "text-neutral-600")}
                  onClick={() => { onCoverFieldChange(undefined); setShowCoverPicker(false) }}
                >
                  None
                </button>
                {coverFields.length === 0 && (
                  <p className="px-3 py-2 text-xs text-neutral-400">Add an Attachment or URL field first</p>
                )}
                {coverFields.map((f) => (
                  <button
                    key={f.id}
                    className={cn("w-full flex items-center px-3 py-1.5 text-xs hover:bg-neutral-50", f.id === coverFieldId ? "text-blue-600 font-medium" : "text-neutral-600")}
                    onClick={() => { onCoverFieldChange(f.id); setShowCoverPicker(false) }}
                  >
                    {f.name}
                    {f.id === coverFieldId && <span className="ml-auto text-blue-400 text-[10px]">✓</span>}
                  </button>
                ))}
              </div>
            </>
          )}
        </div>
      )}

      {records.length === 0 ? (
        <div className="flex flex-col items-center justify-center flex-1 text-neutral-400 gap-2">
          <p className="text-sm">No records yet</p>
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto p-4">
          <div className="grid grid-cols-[repeat(auto-fill,minmax(200px,1fr))] gap-3">
            {records.map((record) => {
              const title = primaryField ? String(record.data[primaryField.id] ?? "") : ""
              const coverValue = coverField ? record.data[coverField.id] : null
              const coverUrl = isImageUrl(coverValue) ? coverValue : null

              return (
                <button
                  key={record.id}
                  onClick={() => onExpand(record)}
                  onContextMenu={(e) => { e.preventDefault(); onContextMenu(record, e.clientX, e.clientY) }}
                  className="flex flex-col rounded-lg border bg-white text-left hover:shadow-md hover:border-neutral-300 transition-all overflow-hidden"
                >
                  {coverField && (
                    <div className="w-full h-32 bg-neutral-100 shrink-0">
                      {coverUrl ? (
                        <img src={coverUrl} alt="" className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-neutral-300">
                          <Image size={24} />
                        </div>
                      )}
                    </div>
                  )}
                  <div className="flex flex-col gap-2 p-3">
                    <p className="text-sm font-medium text-neutral-800 truncate">{title || "Untitled"}</p>
                    {secondaryFields.map((f) => {
                      const raw = record.data[f.id]
                      if (raw == null || raw === "" || (Array.isArray(raw) && raw.length === 0)) return null
                      let display = ""
                      if (f.type === "singleSelect") {
                        display = f.config.options?.find((o) => o.id === raw)?.label ?? String(raw)
                      } else if (f.type === "multiSelect" && Array.isArray(raw)) {
                        display = raw.map((id) => f.config.options?.find((o) => o.id === id)?.label ?? id).join(", ")
                      } else if (f.type === "checkbox") {
                        display = raw ? "Yes" : "No"
                      } else {
                        display = String(raw)
                      }
                      return (
                        <div key={f.id} className="flex flex-col gap-0.5">
                          <span className="text-[10px] text-neutral-400 uppercase tracking-wide">{f.name}</span>
                          <span className="text-xs text-neutral-600 truncate">{display}</span>
                        </div>
                      )
                    })}
                  </div>
                </button>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
