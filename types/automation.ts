// types/automation.ts
import { v4 as uuid } from "uuid"

export type AutomationTriggerType = "field_filled" | "row_created" | "manual"

export interface AutomationTrigger {
  type: AutomationTriggerType
  fieldName?: string  // required when type === "field_filled"
}

export interface AutomationFilter {
  fieldName: string   // e.g. "Category"
  value: string       // e.g. "Art Print"
}

export interface GenerateAIAction {
  type: "generate_ai"
  prompt: string        // supports {{FieldName}} substitution
  writeToFields: string[]
}

export interface PublishEtsyAction {
  type: "publish_etsy"
  taxonomyId?: number
  shopSectionId?: number
  returnPolicyId?: number
  defaultPrice?: number
  publishState: "draft" | "active"
  requireApproval: boolean
}

export interface SetFieldAction {
  type: "set_field"
  fieldName: string
  value: string
}

export type AutomationAction = GenerateAIAction | PublishEtsyAction | SetFieldAction

export interface Automation {
  id: string
  name: string
  active: boolean
  trigger: AutomationTrigger
  filter?: AutomationFilter
  actions: AutomationAction[]
}

export function newAutomation(): Automation {
  return {
    id: uuid(),
    name: "New automation",
    active: true,
    trigger: { type: "field_filled", fieldName: "Images" },
    actions: [],
  }
}

export const DEFAULT_GENERATE_PROMPT = `You are an expert Etsy seller. Analyze the product image(s) and return ONLY valid JSON:
{
  "Title": "keyword-rich title, max 140 chars",
  "Description": "3-5 paragraphs, SEO-optimized",
  "Tags": ["tag1","tag2","tag3","tag4","tag5","tag6","tag7","tag8","tag9","tag10","tag11","tag12","tag13"]
}
Tags: exactly 13, max 20 chars each, lowercase.

Use {{FieldName}} to reference any grid column value in your prompt.`
