"use client"

import { Play, Square, RotateCcw, Loader2, Upload } from "lucide-react"
import { cn } from "@/lib/utils"
import type { AppRecord, Field } from "@/types/core"

interface Props {
  records: AppRecord[]
  fields: Field[]
  selectedRecordIds: string[]
  running: boolean
  progress: { done: number; total: number } | null
  onRun: (recordIds: string[]) => void
  onStop: () => void
  onRetry: () => void
  onPublish: (recordIds: string[]) => void
  publishing: boolean
  publishProgress: { done: number; total: number } | null
}

export function AutomationToolbar({
  records, fields, selectedRecordIds,
  running, progress, onRun, onStop, onRetry,
  onPublish, publishing, publishProgress,
}: Props) {
  const automationStateField = fields.find((f) => f.name === "Automation State")

  const pendingIds = automationStateField
    ? records
        .filter((r) => {
          const state = r.data[automationStateField.id]
          return state == null || state === "idle"
        })
        .map((r) => r.id)
    : []

  const errorIds = automationStateField
    ? records.filter((r) => r.data[automationStateField.id] === "error").map((r) => r.id)
    : []

  const reviewIds = automationStateField
    ? records
        .filter((r) => r.data[automationStateField.id] === "review")
        .map((r) => r.id)
    : []

  const selectedReviewIds = selectedRecordIds.filter((id) => reviewIds.includes(id))
  const publishTarget = selectedReviewIds.length > 0 ? selectedReviewIds : reviewIds

  const hasSelected = selectedRecordIds.length > 0
  const runTarget = hasSelected ? selectedRecordIds : pendingIds

  return (
    <div className="flex items-center gap-2 px-3 py-1 bg-orange-50 border-b border-orange-100 shrink-0">
      <span className="text-[10px] font-semibold uppercase tracking-wider text-orange-400 mr-1 select-none">
        Automation
      </span>

      {publishing ? (
        <>
          <div className="flex items-center gap-1.5 text-xs text-green-600 select-none">
            <Loader2 size={12} className="animate-spin shrink-0" />
            {publishProgress
              ? `Publishing ${publishProgress.done} / ${publishProgress.total}…`
              : "Publishing…"}
          </div>
          <button
            onClick={onStop}
            className="ml-1 flex items-center gap-1 px-2.5 py-0.5 text-xs text-red-600 bg-white hover:bg-red-50 rounded border border-red-200 transition-colors"
          >
            <Square size={11} /> Stop
          </button>
        </>
      ) : running ? (
        <>
          <div className="flex items-center gap-1.5 text-xs text-orange-600 select-none">
            <Loader2 size={12} className="animate-spin shrink-0" />
            {progress ? `Generating ${progress.done} / ${progress.total}…` : "Running…"}
          </div>
          <button
            onClick={onStop}
            className="ml-1 flex items-center gap-1 px-2.5 py-0.5 text-xs text-red-600 bg-white hover:bg-red-50 rounded border border-red-200 transition-colors"
          >
            <Square size={11} /> Stop
          </button>
        </>
      ) : (
        <>
          <button
            onClick={() => onRun(runTarget)}
            disabled={runTarget.length === 0}
            className={cn(
              "flex items-center gap-1 px-2.5 py-0.5 text-xs rounded border transition-colors",
              runTarget.length > 0
                ? "text-orange-600 bg-white hover:bg-orange-50 border-orange-200"
                : "text-neutral-300 bg-white border-neutral-200 cursor-not-allowed"
            )}
          >
            <Play size={11} />
            {hasSelected
              ? `Run selected (${selectedRecordIds.length})`
              : pendingIds.length > 0
              ? `Run pending (${pendingIds.length})`
              : "No pending rows"}
          </button>

          {publishTarget.length > 0 && (
            <button
              onClick={() => onPublish(publishTarget)}
              className="flex items-center gap-1 px-2.5 py-0.5 text-xs text-green-600 bg-white hover:bg-green-50 rounded border border-green-200 transition-colors"
            >
              <Upload size={11} /> Publish ({publishTarget.length})
            </button>
          )}

          {errorIds.length > 0 && (
            <button
              onClick={onRetry}
              className="flex items-center gap-1 px-2.5 py-0.5 text-xs text-red-600 bg-white hover:bg-red-50 rounded border border-red-200 transition-colors"
            >
              <RotateCcw size={11} /> Retry errors ({errorIds.length})
            </button>
          )}
        </>
      )}
    </div>
  )
}
