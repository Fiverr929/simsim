import { v4 as uuid } from "uuid"

export type FieldRole = "trigger" | "context" | "generated" | "default" | "manual" | "hidden"
export type TriggerType = "field_filled" | "fields_filled" | "status_equals" | "row_created" | "manual"
export type PublishState = "draft" | "active"
export type AutomationState = "idle" | "queued" | "detecting" | "generating" | "review" | "published" | "error"

export interface FieldRoleConfig {
  fieldName: string
  roles: FieldRole[]          // combined: ["trigger", "context"]
  defaultValue?: string | number | boolean | null
  contextHint?: string        // placeholder shown in grid cell for context fields
}

export interface TriggerCondition {
  type: TriggerType
  fieldNames?: string[]       // for field_filled / fields_filled
  statusValue?: string        // for status_equals
}

export interface DescriptionBlock {
  id: string
  type: "fixed" | "ai" | "context_var"
  content: string             // static text, AI instructions, or variable name like "title_hint"
}

export interface PostProcessRule {
  id: string
  fieldName: string
  type: "append_tags" | "exclude_tags" | "max_chars" | "capitalize_first" | "regex_replace"
  value: string               // tag list (comma-sep), max num, or regex pattern
  replacement?: string        // for regex_replace only
}

export interface ListingCategory {
  id: string
  name: string
  icon: string
  color: string
  shopSectionId?: number
  taxonomyId?: number
  returnPolicyId?: number
  defaultPrice?: number
  trigger: TriggerCondition
  fieldRoles: FieldRoleConfig[]
  templateId?: string         // reference to PromptTemplate id
  templateOverride?: string   // inline prompt override (takes precedence over templateId)
  descriptionBlocks: DescriptionBlock[]
  postProcessRules: PostProcessRule[]
  publishState: PublishState
  autoPublish: boolean
  requireApproval: boolean
  autoRun: boolean
}

export interface PromptTemplate {
  id: string
  name: string
  description: string
  prompt: string
  parentId?: string           // for inheritance chain
}

export interface ListingSettings {
  fieldDefaults: Record<string, string | number | boolean | null>
  globalAutoRun: boolean
  batchSize: number
  defaultCategoryId?: string
  categories: ListingCategory[]
  templates: PromptTemplate[]
}

export function emptySettings(): ListingSettings {
  return {
    fieldDefaults: {
      "Who Made": "i_did",
      "When Made": "2020_2025",
      "Is Taxable": true,
      "Auto Renew": true,
      "Quantity": 999,
      "Is Supply": false,
    },
    globalAutoRun: false,
    batchSize: 10,
    categories: [],
    templates: [],
  }
}

export function newCategory(): ListingCategory {
  return {
    id: uuid(),
    name: "New Category",
    icon: "🖼️",
    color: "#6366f1",
    trigger: { type: "field_filled", fieldNames: ["Images"] },
    fieldRoles: [],
    descriptionBlocks: [],
    postProcessRules: [],
    publishState: "draft",
    autoPublish: false,
    requireApproval: false,
    autoRun: false,
  }
}

export function newBlock(type: DescriptionBlock["type"] = "fixed"): DescriptionBlock {
  return { id: uuid(), type, content: "" }
}

export function newPostProcessRule(fieldName = "Tags"): PostProcessRule {
  return { id: uuid(), fieldName, type: "append_tags", value: "" }
}

// Variable reference for AI template editor
export const TEMPLATE_VARIABLES: Array<{ name: string; description: string }> = [
  { name: "{{title_hint}}", description: "Value typed in the Title context field" },
  { name: "{{image_analysis}}", description: "AI's description of the uploaded images" },
  { name: "{{category_name}}", description: "Name of the matched category" },
  { name: "{{style_tags}}", description: "Any styles already on the row" },
  { name: "{{shop_section}}", description: "Etsy shop section name from category settings" },
]
