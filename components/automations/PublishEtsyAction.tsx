"use client"

import { useEffect, useState } from "react"
import type { PublishEtsyAction as PublishEtsyActionType } from "@/types/automation"

interface StoreData {
  connected: boolean
  sections: Array<{ id: number; title: string }>
  returnPolicies: Array<{ id: number; name: string }>
  shippingProfiles: Array<{ id: number; title: string }>
}

interface TaxonomyNode {
  id: number
  name: string
  children?: TaxonomyNode[]
}

function flattenTaxonomy(nodes: TaxonomyNode[], prefix = ""): Array<{ id: number; label: string }> {
  const result: Array<{ id: number; label: string }> = []
  for (const node of nodes) {
    const label = prefix ? `${prefix} > ${node.name}` : node.name
    result.push({ id: node.id, label })
    if (node.children?.length) result.push(...flattenTaxonomy(node.children, label))
  }
  return result
}

interface Props {
  action: PublishEtsyActionType
  baseId: string
  onChange: (action: PublishEtsyActionType) => void
}

export function PublishEtsyAction({ action, baseId, onChange }: Props) {
  const [storeData, setStoreData] = useState<StoreData | null>(null)
  const [taxonomy, setTaxonomy] = useState<Array<{ id: number; label: string }>>([])
  const [taxSearch, setTaxSearch] = useState("")

  useEffect(() => {
    fetch(`/api/etsy/store-data/${baseId}`).then((r) => r.json()).then(setStoreData).catch(() => {})
    fetch("/api/etsy/taxonomy").then((r) => r.json()).then((n) => setTaxonomy(flattenTaxonomy(n))).catch(() => {})
  }, [baseId])

  const up = (patch: Partial<PublishEtsyActionType>) => onChange({ ...action, ...patch })

  return (
    <div className="space-y-3">
      <div>
        <label className="text-xs font-medium text-neutral-700 block mb-1">Etsy Category (Taxonomy)</label>
        {taxonomy.length > 0 ? (
          <div className="space-y-1">
            <input
              type="text"
              placeholder="Search…"
              value={taxSearch}
              onChange={(e) => setTaxSearch(e.target.value)}
              className="w-full text-xs border rounded px-2 py-1.5 outline-none focus:border-orange-400"
            />
            <select
              size={4}
              value={action.taxonomyId ?? ""}
              onChange={(e) => up({ taxonomyId: e.target.value ? Number(e.target.value) : undefined })}
              className="w-full text-xs border rounded px-2 py-1 outline-none focus:border-orange-400"
            >
              <option value="">— none —</option>
              {taxonomy
                .filter((t) => !taxSearch || t.label.toLowerCase().includes(taxSearch.toLowerCase()))
                .slice(0, 100)
                .map((t) => <option key={t.id} value={t.id}>{t.label}</option>)}
            </select>
          </div>
        ) : (
          <input
            type="number"
            value={action.taxonomyId ?? ""}
            onChange={(e) => up({ taxonomyId: e.target.value ? Number(e.target.value) : undefined })}
            placeholder="Connect store to load categories"
            className="w-full text-xs border rounded px-2 py-1.5 outline-none focus:border-orange-400"
          />
        )}
      </div>

      <div>
        <label className="text-xs font-medium text-neutral-700 block mb-1">Shop Section</label>
        {storeData?.connected && storeData.sections.length > 0 ? (
          <select
            value={action.shopSectionId ?? ""}
            onChange={(e) => up({ shopSectionId: e.target.value ? Number(e.target.value) : undefined })}
            className="w-full text-xs border rounded px-2 py-1.5 outline-none focus:border-orange-400"
          >
            <option value="">— none —</option>
            {storeData.sections.map((s) => <option key={s.id} value={s.id}>{s.title}</option>)}
          </select>
        ) : (
          <input
            type="number"
            value={action.shopSectionId ?? ""}
            onChange={(e) => up({ shopSectionId: e.target.value ? Number(e.target.value) : undefined })}
            placeholder={storeData?.connected ? "No sections found" : "Connect store for dropdown"}
            className="w-full text-xs border rounded px-2 py-1.5 outline-none focus:border-orange-400"
          />
        )}
      </div>

      <div>
        <label className="text-xs font-medium text-neutral-700 block mb-1">Return Policy</label>
        {storeData?.connected && storeData.returnPolicies.length > 0 ? (
          <select
            value={action.returnPolicyId ?? ""}
            onChange={(e) => up({ returnPolicyId: e.target.value ? Number(e.target.value) : undefined })}
            className="w-full text-xs border rounded px-2 py-1.5 outline-none focus:border-orange-400"
          >
            <option value="">— none —</option>
            {storeData.returnPolicies.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        ) : (
          <input
            type="number"
            value={action.returnPolicyId ?? ""}
            onChange={(e) => up({ returnPolicyId: e.target.value ? Number(e.target.value) : undefined })}
            placeholder={storeData?.connected ? "No policies found" : "Connect store for dropdown"}
            className="w-full text-xs border rounded px-2 py-1.5 outline-none focus:border-orange-400"
          />
        )}
      </div>

      <div>
        <label className="text-xs font-medium text-neutral-700 block mb-1">Default Price ($)</label>
        <input
          type="number"
          value={action.defaultPrice ?? ""}
          onChange={(e) => up({ defaultPrice: e.target.value ? Number(e.target.value) : undefined })}
          className="w-full text-xs border rounded px-2 py-1.5 outline-none focus:border-orange-400"
        />
      </div>

      <div className="flex items-center gap-4">
        <span className="text-xs font-medium text-neutral-700 w-28 shrink-0">Publish as</span>
        <label className="flex items-center gap-1.5 text-xs text-neutral-700 cursor-pointer">
          <input
            type="radio"
            checked={action.publishState === "draft"}
            onChange={() => up({ publishState: "draft" })}
            className="accent-orange-500"
          /> Draft
        </label>
        <label className="flex items-center gap-1.5 text-xs text-neutral-700 cursor-pointer">
          <input
            type="radio"
            checked={action.publishState === "active"}
            onChange={() => up({ publishState: "active" })}
            className="accent-orange-500"
          /> Active
        </label>
      </div>

      <label className="flex items-center gap-3 cursor-pointer">
        <input
          type="checkbox"
          checked={action.requireApproval}
          onChange={(e) => up({ requireApproval: e.target.checked })}
          className="w-4 h-4 rounded accent-orange-500"
        />
        <span className="text-xs text-neutral-700">Require manual approval before publishing</span>
      </label>
    </div>
  )
}
