"use client"

import { useState } from "react"
import { Info } from "lucide-react"
import { TEMPLATE_VARIABLES } from "@/types/listing-settings"
import type { DescriptionBlock, PromptTemplate } from "@/types/listing-settings"
import { DescriptionBlockEditor } from "./DescriptionBlockEditor"

interface Props {
  templateOverride?: string
  descriptionBlocks: DescriptionBlock[]
  templates: PromptTemplate[]
  selectedTemplateId?: string
  onTemplateChange: (id: string) => void
  onOverrideChange: (v: string) => void
  onBlocksChange: (blocks: DescriptionBlock[]) => void
}

export function AITemplateEditor({
  templateOverride, descriptionBlocks, templates, selectedTemplateId,
  onTemplateChange, onOverrideChange, onBlocksChange,
}: Props) {
  const [showVars, setShowVars] = useState(false)

  const baseTemplate = templates.find((t) => t.id === selectedTemplateId)

  return (
    <div className="max-w-2xl space-y-6">
      {/* Template library selection */}
      {templates.length > 0 && (
        <div>
          <label className="text-xs font-medium text-neutral-700 block mb-1">Base template (from library)</label>
          <select
            value={selectedTemplateId ?? ""}
            onChange={(e) => onTemplateChange(e.target.value)}
            className="w-full text-xs border rounded px-2 py-1.5 outline-none focus:border-orange-400"
          >
            <option value="">None — use inline prompt only</option>
            {templates.map((t) => (
              <option key={t.id} value={t.id}>{t.name}</option>
            ))}
          </select>
          {baseTemplate && (
            <p className="mt-1 text-[11px] text-neutral-400 bg-neutral-50 rounded p-2 font-mono whitespace-pre-wrap">
              {baseTemplate.prompt}
            </p>
          )}
        </div>
      )}

      {/* Inline prompt override */}
      <div>
        <div className="flex items-center gap-2 mb-1">
          <label className="text-xs font-medium text-neutral-700">
            {baseTemplate ? "Prompt override (takes precedence over base template)" : "AI prompt"}
          </label>
          <button
            onClick={() => setShowVars((v) => !v)}
            className="flex items-center gap-1 text-[11px] text-orange-500 hover:text-orange-700"
          >
            <Info size={11} /> Variables
          </button>
        </div>

        {showVars && (
          <div className="mb-2 p-2 rounded-lg bg-orange-50 border border-orange-100 space-y-1">
            {TEMPLATE_VARIABLES.map((v) => (
              <div key={v.name} className="flex items-start gap-2 text-[11px]">
                <code className="text-orange-600 font-mono shrink-0">{v.name}</code>
                <span className="text-neutral-500">{v.description}</span>
              </div>
            ))}
          </div>
        )}

        <textarea
          value={templateOverride ?? ""}
          onChange={(e) => onOverrideChange(e.target.value)}
          rows={8}
          placeholder={`Write your AI prompt here. Use variables like {{image_analysis}} and {{title_hint}}.

Example:
You are an expert Etsy seller. Based on the image and the hint "{{title_hint}}", write an SEO-optimized listing. Return JSON: { "title": "...", "tags": [...] }`}
          className="w-full text-xs border rounded px-3 py-2 outline-none focus:border-orange-400 font-mono resize-y"
        />
        <p className="text-[11px] text-neutral-400 mt-1">
          The prompt must return JSON matching the fields you want to generate.
        </p>
      </div>

      {/* Description block template */}
      <div>
        <label className="text-xs font-medium text-neutral-700 block mb-1">Description template</label>
        <p className="text-[11px] text-neutral-400 mb-3">
          Build the Description field from ordered blocks. <strong>Fixed</strong> blocks are verbatim text.{" "}
          <strong>AI</strong> blocks are filled by the model. <strong>Context var</strong> pulls a field value.
        </p>
        <DescriptionBlockEditor blocks={descriptionBlocks} onChange={onBlocksChange} />
      </div>
    </div>
  )
}
