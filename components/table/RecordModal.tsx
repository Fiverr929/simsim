"use client"

import { useCallback, useEffect, useState } from "react"
import { X, Paperclip, Upload, Trash2, Clock, Sparkles, Send, Loader2 } from "lucide-react"
import { toast } from "sonner"
import { ConfirmDialog } from "@/components/ui/ConfirmDialog"
import { useDropzone } from "react-dropzone"
import type { AppRecord, CellValue, Field } from "@/types/core"
import { ExpandPanel } from "@/components/layout/ExpandPanel"
import { cn, formatDate } from "@/lib/utils"

interface Props {
  record: AppRecord
  fields: Field[]
  integration?: string
  onUpdate: (id: string, data: Record<string, CellValue>) => void
  onDelete?: (id: string) => Promise<boolean | void>
  onClose: () => void
}

function AttachmentInput({ value, onChange }: { value: CellValue; onChange: (v: CellValue) => void }) {
  const urls: string[] = Array.isArray(value) ? value : []
  const [uploading, setUploading] = useState(false)

  const onDrop = useCallback(async (files: File[]) => {
    if (!files.length) return
    setUploading(true)
    try {
      const uploaded = await Promise.all(files.map(async (file) => {
        const fd = new FormData()
        fd.append("file", file)
        const res = await fetch("/api/upload", { method: "POST", body: fd })
        if (!res.ok) return null
        const { url } = await res.json()
        return url as string
      }))
      const next = [...urls, ...uploaded.filter(Boolean) as string[]]
      onChange(next.length ? next : null)
    } finally {
      setUploading(false)
    }
  }, [urls, onChange])

  const { getRootProps, getInputProps, isDragActive } = useDropzone({ onDrop, disabled: uploading, multiple: true })

  const remove = (url: string) => {
    const next = urls.filter((u) => u !== url)
    onChange(next.length ? next : null)
  }

  const isImage = (url: string) => /\.(jpe?g|png|gif|webp|avif|svg)$/i.test(url)

  return (
    <div className="space-y-2">
      {urls.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {urls.map((url) => (
            <div key={url} className="group relative">
              {isImage(url) ? (
                <div className="relative w-20 h-20 rounded-lg overflow-hidden border bg-neutral-50">
                  <img src={url} alt="" className="w-full h-full object-cover" />
                  <button
                    onClick={() => remove(url)}
                    className="absolute top-0.5 right-0.5 opacity-0 group-hover:opacity-100 bg-black/50 text-white rounded-full p-0.5 transition-opacity"
                  >
                    <X size={10} />
                  </button>
                </div>
              ) : (
                <div className="flex items-center gap-1.5 px-2 py-1.5 rounded-lg border bg-neutral-50 text-xs text-neutral-700">
                  <Paperclip size={11} className="text-neutral-400 shrink-0" />
                  <a href={url} target="_blank" rel="noreferrer" className="hover:underline max-w-32 truncate">
                    {url.split("/").pop()}
                  </a>
                  <button onClick={() => remove(url)} className="text-neutral-300 hover:text-red-500 ml-1">
                    <X size={10} />
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
      <div
        {...getRootProps()}
        className={`flex items-center gap-2 px-3 py-2.5 rounded-lg border-2 border-dashed cursor-pointer transition-colors text-xs ${
          isDragActive ? "border-blue-400 bg-blue-50 text-blue-600" : "border-neutral-200 text-neutral-400 hover:border-neutral-300 hover:bg-neutral-50"
        }`}
      >
        <input {...getInputProps()} />
        <Upload size={13} />
        {uploading ? "Uploading…" : isDragActive ? "Drop files here" : "Drop files or click to upload"}
      </div>
    </div>
  )
}

function FieldInput({ field, value, onChange }: { field: Field; value: CellValue; onChange: (v: CellValue) => void }) {
  const str = Array.isArray(value) ? value.join(", ") : value != null ? String(value) : ""

  switch (field.type) {
    case "checkbox":
      return (
        <input
          type="checkbox"
          checked={Boolean(value)}
          onChange={(e) => onChange(e.target.checked)}
          className="w-4 h-4 rounded border-neutral-300"
        />
      )
    case "number":
      return (
        <input
          type="number"
          defaultValue={typeof value === "number" ? value : ""}
          onBlur={(e) => onChange(e.target.value === "" ? null : Number(e.target.value))}
          className="w-full text-sm border rounded px-2 py-1.5 outline-none focus:border-blue-400"
        />
      )
    case "longText":
      return (
        <textarea
          defaultValue={str}
          rows={4}
          onBlur={(e) => onChange(e.target.value || null)}
          className="w-full text-sm border rounded px-2 py-1.5 outline-none focus:border-blue-400 resize-none"
        />
      )
    case "singleSelect": {
      const options = field.config.options ?? []
      return (
        <select
          defaultValue={typeof value === "string" ? value : ""}
          onChange={(e) => onChange(e.target.value || null)}
          className="w-full text-sm border rounded px-2 py-1.5 outline-none focus:border-blue-400 bg-white"
        >
          <option value="">—</option>
          {options.map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}
        </select>
      )
    }
    case "multiSelect": {
      const options = field.config.options ?? []
      const selected = Array.isArray(value) ? value : []
      return (
        <div className="flex flex-wrap gap-1.5">
          {options.map((o) => {
            const active = selected.includes(o.id)
            return (
              <button
                key={o.id}
                onClick={() => {
                  const next = active ? selected.filter((id) => id !== o.id) : [...selected, o.id]
                  onChange(next.length ? next : null)
                }}
                className="flex items-center gap-1 px-2 py-0.5 rounded-full text-xs border transition-colors"
                style={active ? { background: o.color + "33", borderColor: o.color, color: o.color } : {}}
              >
                <span className="w-2 h-2 rounded-full" style={{ background: o.color }} />
                {o.label}
              </button>
            )
          })}
          {options.length === 0 && <p className="text-xs text-neutral-400">No options — edit field to add some</p>}
        </div>
      )
    }
    case "date":
      return (
        <div className="space-y-1">
          <input
            type="date"
            defaultValue={str}
            onBlur={(e) => onChange(e.target.value || null)}
            className="w-full text-sm border rounded px-2 py-1.5 outline-none focus:border-blue-400"
          />
          {str && (
            <p className="text-xs text-neutral-400">{formatDate(str, field.config)}</p>
          )}
        </div>
      )
    case "url":
      return (
        <div className="space-y-1.5">
          <input
            type="url"
            defaultValue={str}
            onBlur={(e) => onChange(e.target.value || null)}
            className="w-full text-sm border rounded px-2 py-1.5 outline-none focus:border-blue-400"
            placeholder="https://…"
          />
          {str && (
            <a
              href={str.startsWith("http") ? str : `https://${str}`}
              target="_blank"
              rel="noreferrer"
              className="inline-block text-xs text-blue-500 hover:underline truncate max-w-full"
            >
              {str}
            </a>
          )}
        </div>
      )
    case "attachment":
      return <AttachmentInput value={value} onChange={onChange} />
    default:
      return (
        <input
          type="text"
          defaultValue={str}
          onBlur={(e) => onChange(e.target.value || null)}
          className="w-full text-sm border rounded px-2 py-1.5 outline-none focus:border-blue-400"
        />
      )
  }
}

export function RecordModal({ record, fields, integration, onUpdate, onDelete, onClose }: Props) {
  const [data, setData] = useState<Record<string, CellValue>>(record.data)
  const [localFields, setLocalFields] = useState<Field[]>(fields)
  const [deleting, setDeleting] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [generateLoading, setGenerateLoading] = useState(false)
  const [publishLoading, setPublishLoading] = useState(false)

  const primaryField = localFields.find((f) => f.isPrimary) ?? localFields[0]
  const title = primaryField ? String(data[primaryField.id] ?? "Untitled") : "Record"

  useEffect(() => { setData(record.data) }, [record.id])
  useEffect(() => { setLocalFields(fields) }, [fields])

  const isEtsyTable = integration === "etsy"

  const imagesField = localFields.find((f) => f.name === "Images")
  const hasImages = imagesField
    ? Array.isArray(data[imagesField.id]) && (data[imagesField.id] as string[]).length > 0
    : false

  const statusField = localFields.find((f) => f.name === "Status")
  const isPublished = statusField ? data[statusField.id] === "published" : false

  const handleChange = (fieldId: string, value: CellValue) => {
    setData((prev) => ({ ...prev, [fieldId]: value }))
    onUpdate(record.id, { [fieldId]: value })
  }

  const handleDelete = async () => {
    if (!onDelete) return
    setDeleting(true)
    try {
      const ok = await onDelete(record.id)
      if (ok === false) {
        toast.error("Failed to delete record")
        return
      }
      onClose()
    } catch {
      toast.error("Failed to delete record")
    } finally {
      setDeleting(false)
      setShowDeleteConfirm(false)
    }
  }

  const handleGenerate = async () => {
    setGenerateLoading(true)
    try {
      const res = await fetch("/api/ai/generate-listing", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ recordId: record.id }),
      })
      const json = await res.json()
      if (!res.ok) {
        toast.error(json.error ?? "Generation failed")
        return
      }
      setData((prev) => ({ ...prev, ...json.fieldUpdates }))
      if (json.updatedFields?.length) {
        setLocalFields((prev) =>
          prev.map((f) => {
            const updated = json.updatedFields.find((u: Field) => u.id === f.id)
            return updated ? { ...f, config: updated.config } : f
          })
        )
      }
      onUpdate(record.id, json.fieldUpdates)
      toast.success("Listing generated")
    } catch {
      toast.error("Generation failed")
    } finally {
      setGenerateLoading(false)
    }
  }

  const handlePublish = async () => {
    setPublishLoading(true)
    try {
      const res = await fetch("/api/etsy/publish", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ recordId: record.id }),
      })
      const json = await res.json()
      if (!res.ok) {
        toast.error(json.error ?? "Publish failed")
        return
      }
      setData((prev) => ({ ...prev, ...json.fieldUpdates }))
      onUpdate(record.id, json.fieldUpdates)
      toast.success(`Published — listing #${json.etsyListingId}`)
    } catch {
      toast.error("Publish failed")
    } finally {
      setPublishLoading(false)
    }
  }

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose() }
    document.addEventListener("keydown", handler)
    return () => document.removeEventListener("keydown", handler)
  }, [onClose])

  const created = new Date(record.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
  const updated = record.updatedAt ? new Date(record.updatedAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" }) : null

  return (
    <>
      <ExpandPanel visible className="flex flex-col">
        <div className="h-1.5 bg-blue-500 shrink-0" />
        <div className="flex items-center justify-between px-5 py-3 border-b shrink-0">
          <div className="min-w-0">
            <p className="text-sm font-semibold text-neutral-800 truncate">{title}</p>
            {primaryField && title !== "Untitled" && (
              <p className="text-[10px] text-neutral-400 mt-0.5">{primaryField.name}</p>
            )}
          </div>
          <div className="flex items-center gap-1">
            {onDelete && (
              <button
                onClick={() => setShowDeleteConfirm(true)}
                disabled={deleting}
                className="p-1.5 rounded hover:bg-red-50 text-neutral-400 hover:text-red-600 transition-colors"
                title="Delete record"
              >
                <Trash2 size={14} />
              </button>
            )}
            <button onClick={onClose} className="p-1 rounded hover:bg-neutral-100 text-neutral-400">
              <X size={16} />
            </button>
          </div>
        </div>

        {isEtsyTable && (
          <div className="flex items-center gap-2 px-5 py-2.5 border-b bg-orange-50 shrink-0">
            <button
              onClick={handleGenerate}
              disabled={generateLoading || !hasImages}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-violet-500 text-white hover:bg-violet-600 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              {generateLoading ? <Loader2 size={12} className="animate-spin" /> : <Sparkles size={12} />}
              Generate with AI
            </button>
            <button
              onClick={handlePublish}
              disabled={publishLoading || isPublished}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-orange-500 text-white hover:bg-orange-600 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              {publishLoading ? <Loader2 size={12} className="animate-spin" /> : <Send size={12} />}
              {isPublished ? "Published" : "Publish to Etsy"}
            </button>
          </div>
        )}

        <div className="flex-1 overflow-y-auto">
          <div className="p-5 space-y-4">
            {(isEtsyTable
              ? [...localFields.filter((f) => f.name === "Images"), ...localFields.filter((f) => f.name !== "Images")]
              : localFields
            ).map((field) => {
              const isPrimary = field.isPrimary
              return (
                <div key={field.id} className={isPrimary ? "pb-4 border-b border-neutral-100" : ""}>
                  <label className={cn(
                    "block text-xs font-medium mb-1.5",
                    isPrimary ? "text-blue-600" : "text-neutral-500"
                  )}>
                    {field.name}
                  </label>
                  <FieldInput
                    field={field}
                    value={data[field.id] ?? null}
                    onChange={(v) => handleChange(field.id, v)}
                  />
                </div>
              )
            })}
            {localFields.length === 0 && (
              <p className="text-xs text-neutral-400 text-center py-8">No fields configured</p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-1.5 px-5 py-2.5 border-t bg-neutral-50 shrink-0">
          <Clock size={11} className="text-neutral-300" />
          <span className="text-[10px] text-neutral-400">
            Created {created}{updated ? ` · Updated ${updated}` : ""}
          </span>
        </div>
      </ExpandPanel>

      {showDeleteConfirm && (
        <ConfirmDialog
          title="Delete record?"
          description="This cannot be undone."
          onConfirm={handleDelete}
          onCancel={() => setShowDeleteConfirm(false)}
        />
      )}
    </>
  )
}
