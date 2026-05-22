import { NextResponse } from "next/server"
import { prisma } from "@/lib/db"
import { handleApiError, apiError } from "@/lib/api"

const WHEN_MADE_OPTIONS = [
  { id: "made_to_order", label: "Made to order", color: "#a3a3a3" },
  { id: "2020_2025", label: "2020-2025", color: "#a3a3a3" },
  { id: "2010_2019", label: "2010-2019", color: "#a3a3a3" },
  { id: "2006_2009", label: "2006-2009", color: "#a3a3a3" },
  { id: "before_2006", label: "Before 2006", color: "#a3a3a3" },
]

const WHO_MADE_OPTIONS = [
  { id: "i_did", label: "I did", color: "#a3a3a3" },
  { id: "collective", label: "Collective", color: "#a3a3a3" },
  { id: "someone_else", label: "Someone else", color: "#a3a3a3" },
]

const STATUS_OPTIONS = [
  { id: "empty", label: "Empty", color: "#a3a3a3" },
  { id: "draft", label: "Draft", color: "#eab308" },
  { id: "ready", label: "Ready", color: "#22c55e" },
  { id: "published", label: "Published", color: "#3b82f6" },
]

const AUTOMATION_STATE_OPTIONS = [
  { id: "idle", label: "Idle", color: "#a3a3a3" },
  { id: "queued", label: "Queued", color: "#eab308" },
  { id: "detecting", label: "Detecting", color: "#3b82f6" },
  { id: "generating", label: "Generating", color: "#8b5cf6" },
  { id: "review", label: "Review", color: "#f97316" },
  { id: "published", label: "Published", color: "#22c55e" },
  { id: "error", label: "Error", color: "#ef4444" },
]

const COMMON_FIELDS = [
  { name: "Title", type: "text", isPrimary: true, config: {} },
  { name: "Description", type: "longText", config: {} },
  { name: "Type", type: "singleSelect", config: { options: [{ id: "digital", label: "Digital", color: "#a3a3a3" }] } },
  { name: "Price", type: "number", config: { numberFormat: "currency", currency: "USD" } },
  { name: "Quantity", type: "number", config: { numberFormat: "integer" } },
  { name: "Status", type: "singleSelect", config: { options: STATUS_OPTIONS } },
  { name: "Automation State", type: "singleSelect", config: { options: AUTOMATION_STATE_OPTIONS } },
  { name: "Category", type: "singleSelect", config: { options: [] } },
  { name: "Tags", type: "multiSelect", config: {} },
  { name: "Styles", type: "multiSelect", config: {} },
  { name: "Images", type: "attachment", config: {} },
  { name: "Video", type: "attachment", config: {} },
  { name: "SKU", type: "text", config: {} },
  { name: "Taxonomy ID", type: "number", config: { numberFormat: "integer" } },
  { name: "When Made", type: "singleSelect", config: { options: WHEN_MADE_OPTIONS } },
  { name: "Who Made", type: "singleSelect", config: { options: WHO_MADE_OPTIONS } },
  { name: "Is Supply", type: "checkbox", config: {} },
  { name: "AI Generated", type: "checkbox", config: {} },
  { name: "Is Personalizable", type: "checkbox", config: {} },
  { name: "Personalisation Required", type: "checkbox", config: {} },
  { name: "Personalisation Max Chars", type: "number", config: { numberFormat: "integer" } },
  { name: "Personalisation Instructions", type: "longText", config: {} },
  { name: "Featured", type: "checkbox", config: {} },
  { name: "Shop Section ID", type: "number", config: { numberFormat: "integer" } },
  { name: "Return Policy ID", type: "number", config: { numberFormat: "integer" } },
  { name: "Is Taxable", type: "checkbox", config: {} },
  { name: "Auto Renew", type: "checkbox", config: {} },
  { name: "Processing Min Days", type: "number", config: { numberFormat: "integer" } },
  { name: "Processing Max Days", type: "number", config: { numberFormat: "integer" } },
  { name: "Last Generated At", type: "date", config: {} },
  { name: "Listing URL", type: "url", config: {} },
  { name: "Etsy Listing ID", type: "number", config: { numberFormat: "integer" } },
] as const

const DIGITAL_FIELDS = [
  ...COMMON_FIELDS.slice(0, 12), // Title → Video
  { name: "Digital Files", type: "attachment", config: {} },
  ...COMMON_FIELDS.slice(12), // SKU → Etsy Listing ID
] as const

const PHYSICAL_FIELDS = [
  ...COMMON_FIELDS,
  { name: "Materials", type: "multiSelect", config: {} },
  { name: "Production Partner IDs", type: "text", config: {} },
  { name: "Shipping Profile ID", type: "number", config: { numberFormat: "integer" } },
] as const

async function createTable(
  name: string,
  order: number,
  baseId: string,
  fieldDefs: ReadonlyArray<{ name: string; type: string; config: object; isPrimary?: boolean }>
) {
  const table = await prisma.table.create({ data: { name, order, baseId } })

  await Promise.all(
    fieldDefs.map((f, i) =>
      prisma.field.create({
        data: {
          name: f.name,
          type: f.type,
          config: JSON.stringify(f.config),
          order: i,
          isPrimary: f.isPrimary ?? false,
          tableId: table.id,
        },
      })
    )
  )

  await prisma.view.createMany({
    data: [
      { name: "All Listings", type: "grid", order: 0, tableId: table.id },
      { name: "Gallery", type: "gallery", order: 1, tableId: table.id },
      { name: "By Status", type: "kanban", order: 2, tableId: table.id },
    ],
  })

  return prisma.table.findUnique({
    where: { id: table.id },
    include: { fields: { orderBy: { order: "asc" } }, views: { orderBy: { order: "asc" } } },
  })
}

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}))
    const spaceId = body.spaceId
    if (!spaceId) return apiError("spaceId required", 400)

    const base = await prisma.base.create({
      data: { name: "Etsy Store", icon: "🛍️", config: JSON.stringify({ integration: "etsy" }), spaceId },
    })

    const [digitalTable, physicalTable] = await Promise.all([
      createTable("Digital Listings", 0, base.id, DIGITAL_FIELDS),
      createTable("Physical Listings", 1, base.id, PHYSICAL_FIELDS),
    ])

    return NextResponse.json({
      id: base.id,
      name: base.name,
      icon: base.icon,
      spaceId: base.spaceId,
      createdAt: base.createdAt,
      config: JSON.parse(base.config),
      tables: [digitalTable, physicalTable].map((t) => ({ id: t!.id, name: t!.name, order: t!.order, baseId: t!.baseId })),
      firstTableId: digitalTable!.id,
      firstViewId: digitalTable!.views![0]?.id ?? null,
    }, { status: 201 })
  } catch (err) {
    return handleApiError(err)
  }
}
