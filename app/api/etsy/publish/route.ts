import { NextResponse } from "next/server"
import { readFile } from "fs/promises"
import { join } from "path"
import FormData from "form-data"
import { getEtsyClient } from "@/lib/etsy/client"
import type { EtsyCreateListingPayload } from "@/lib/etsy/types"
import { prisma } from "@/lib/db"
import { handleApiError, apiError } from "@/lib/api"
import type { CellValue } from "@/types/core"

const SHOP_ID = process.env.ETSY_SHOP_ID!

function resolveMultiSelectLabels(
  fieldConfig: string,
  value: CellValue
): string[] {
  if (!Array.isArray(value)) return []
  const config = JSON.parse(fieldConfig) as { options?: Array<{ id: string; label: string }> }
  const options = config.options ?? []
  return value.map((id) => options.find((o) => o.id === id)?.label ?? id).filter(Boolean)
}

function resolveSingleSelectLabel(fieldConfig: string, value: CellValue): string {
  if (typeof value !== "string") return ""
  const config = JSON.parse(fieldConfig) as { options?: Array<{ id: string; label: string }> }
  return config.options?.find((o) => o.id === value)?.label ?? value
}

export async function POST(req: Request) {
  try {
    const { recordId } = await req.json()
    if (!recordId) return apiError("recordId required", 400)

    const record = await prisma.record.findUnique({
      where: { id: recordId },
      include: { table: { include: { fields: true } } },
    })
    if (!record) return apiError("Record not found", 404)

    const fields = record.table.fields
    const data = JSON.parse(record.data) as Record<string, CellValue>
    const fieldByName = Object.fromEntries(fields.map((f) => [f.name, f]))

    const get = (name: string): CellValue => data[fieldByName[name]?.id ?? ""] ?? null

    // Build Etsy listing payload
    const typeLabel = resolveSingleSelectLabel(
      fieldByName["Type"]?.config ?? "{}",
      get("Type")
    )
    const listingType: EtsyCreateListingPayload["type"] =
      typeLabel === "Digital" ? "download" : "physical"

    const payload: EtsyCreateListingPayload = {
      quantity: (get("Quantity") as number) ?? 999,
      title: (get("Title") as string) ?? "",
      description: (get("Description") as string) ?? "",
      price: (get("Price") as number) ?? 0,
      who_made: resolveSingleSelectLabel(fieldByName["Who Made"]?.config ?? "{}", get("Who Made")) || "i_did",
      when_made: resolveSingleSelectLabel(fieldByName["When Made"]?.config ?? "{}", get("When Made")) || "made_to_order",
      taxonomy_id: (get("Taxonomy ID") as number) ?? 0,
      type: listingType,
    }

    // Optional fields
    const tags = resolveMultiSelectLabels(fieldByName["Tags"]?.config ?? "{}", get("Tags"))
    if (tags.length) payload.tags = tags.slice(0, 13)

    const styles = resolveMultiSelectLabels(fieldByName["Styles"]?.config ?? "{}", get("Styles"))
    if (styles.length) payload.styles = styles.slice(0, 2)

    const materials = resolveMultiSelectLabels(fieldByName["Materials"]?.config ?? "{}", get("Materials"))
    if (materials.length) payload.materials = materials

    const sku = get("SKU") as string | null
    if (sku) payload.skus = [sku]

    const shopSectionId = get("Shop Section ID") as number | null
    if (shopSectionId) payload.shop_section_id = shopSectionId

    const returnPolicyId = get("Return Policy ID") as number | null
    if (returnPolicyId) payload.return_policy_id = returnPolicyId

    const isSupply = get("Is Supply")
    if (isSupply != null) payload.is_supply = Boolean(isSupply)

    const isPersonalizable = get("Is Personalizable")
    if (isPersonalizable) {
      payload.is_personalizable = true
      const isRequired = get("Personalisation Required")
      if (isRequired != null) payload.personalizable_is_required = Boolean(isRequired)
      const maxChars = get("Personalisation Max Chars") as number | null
      if (maxChars) payload.personalizable_char_count_max = maxChars
      const instructions = get("Personalisation Instructions") as string | null
      if (instructions) payload.personalizable_prop = instructions
    }

    const isFeatured = get("Featured")
    if (isFeatured) payload.featured_rank = 1

    const isTaxable = get("Is Taxable")
    if (isTaxable != null) payload.is_taxable = Boolean(isTaxable)

    const autoRenew = get("Auto Renew")
    if (autoRenew != null) payload.should_auto_renew = Boolean(autoRenew)

    const partnerIds = get("Production Partner IDs") as string | null
    if (partnerIds) {
      const ids = partnerIds.split(",").map((s) => Number(s.trim())).filter(Boolean)
      if (ids.length) payload.production_partner_ids = ids
    }

    const etsy = await getEtsyClient()

    // 1. Create draft listing
    const createRes = await etsy.post(`/application/shops/${SHOP_ID}/listings`, payload)
    const listingId: number = createRes.data.listing_id

    // 2. Upload images
    const imageUrls: string[] = Array.isArray(get("Images")) ? (get("Images") as string[]) : []
    for (let i = 0; i < imageUrls.length; i++) {
      try {
        const filePath = join(process.cwd(), "public", imageUrls[i])
        const buffer = await readFile(filePath)
        const fd = new FormData()
        fd.append("image", buffer, { filename: imageUrls[i].split("/").pop() ?? "image.jpg" })
        fd.append("rank", String(i + 1))
        await etsy.post(`/application/shops/${SHOP_ID}/listings/${listingId}/images`, fd, {
          headers: fd.getHeaders(),
        })
      } catch (e) {
        console.error(`Image upload failed for listing ${listingId}:`, e)
      }
    }

    // 3. Upload video (if present)
    const videoUrls: string[] = Array.isArray(get("Video")) ? (get("Video") as string[]) : []
    if (videoUrls[0]) {
      try {
        const filePath = join(process.cwd(), "public", videoUrls[0])
        const buffer = await readFile(filePath)
        const fd = new FormData()
        fd.append("video", buffer, { filename: videoUrls[0].split("/").pop() ?? "video.mp4" })
        await etsy.post(`/application/shops/${SHOP_ID}/listings/${listingId}/videos`, fd, {
          headers: fd.getHeaders(),
        })
      } catch (e) {
        console.error(`Video upload failed for listing ${listingId}:`, e)
      }
    }

    // 4. Upload digital files (Digital Listings table only)
    if (record.table.name === "Digital Listings") {
      const digitalUrls: string[] = Array.isArray(get("Digital Files")) ? (get("Digital Files") as string[]) : []
      for (const url of digitalUrls) {
        try {
          const filePath = join(process.cwd(), "public", url)
          const buffer = await readFile(filePath)
          const fd = new FormData()
          fd.append("file", buffer, { filename: url.split("/").pop() ?? "file" })
          await etsy.post(`/application/shops/${SHOP_ID}/listings/${listingId}/files`, fd, {
            headers: fd.getHeaders(),
          })
        } catch (e) {
          console.error(`Digital file upload failed for listing ${listingId}:`, e)
        }
      }
    }

    // 5. Activate listing
    await etsy.put(`/application/shops/${SHOP_ID}/listings/${listingId}`, { state: "active" })

    // 6. Write Etsy Listing ID, Listing URL, Automation State, and status=published back to record
    const etsyIdField = fieldByName["Etsy Listing ID"]
    const statusField = fieldByName["Status"]
    const listingUrlField = fieldByName["Listing URL"]
    const automationStateField = fieldByName["Automation State"]

    const fieldUpdates: Record<string, CellValue> = {}
    if (etsyIdField) fieldUpdates[etsyIdField.id] = listingId
    if (statusField) fieldUpdates[statusField.id] = "published"
    if (listingUrlField) fieldUpdates[listingUrlField.id] = `https://www.etsy.com/listing/${listingId}`
    if (automationStateField) {
      const stateConfig = JSON.parse(automationStateField.config ?? "{}") as {
        options?: Array<{ id: string; label: string }>
      }
      const publishedOption = stateConfig.options?.find((o) => o.label === "published")
      if (publishedOption) fieldUpdates[automationStateField.id] = publishedOption.id
    }

    const merged = { ...data, ...fieldUpdates }
    await prisma.record.update({
      where: { id: recordId },
      data: { data: JSON.stringify(merged) },
    })

    return NextResponse.json({ etsyListingId: listingId, fieldUpdates })
  } catch (err) {
    console.error("Etsy publish error:", err)
    return handleApiError(err)
  }
}
