export interface EtsyCreateListingPayload {
  quantity: number
  title: string
  description: string
  price: number
  who_made: string
  when_made: string
  taxonomy_id: number
  type: "physical" | "download" | "both"
  tags?: string[]
  styles?: string[]
  materials?: string[]
  shop_section_id?: number
  is_supply?: boolean
  is_personalizable?: boolean
  personalizable_prop?: string
  personalizable_is_required?: boolean
  personalizable_char_count_max?: number
  featured_rank?: number
  should_auto_renew?: boolean
  is_taxable?: boolean
  return_policy_id?: number
  production_partner_ids?: number[]
  skus?: string[]
}

export interface EtsyListing {
  listing_id: number
  state: string
  title: string
}
