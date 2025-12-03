/**
 * Health Guild Data Types
 * Canonical data format for import/export and browser storage
 */

export interface UserProfile {
  age: number
  sex: "male" | "female" | "other" | "unknown"
  race?: string | null
  height_cm?: number | null
  weight_kg?: number | null
  zip_code?: string | null
  smoker?: boolean | null
  diabetic?: boolean | null
  on_bp_meds?: boolean | null
  medications?: {
    statin?: boolean | null
    thyroid?: boolean | null
    metformin_or_t2d_med?: boolean | null
    glp1?: boolean | null
    trt_hrt?: boolean | null
  }
}

export interface LabSnapshot {
  date: string  // ISO date
  context?: string | null  // "Annual physical 2024"
  labs: Record<string, number | null>  // Flexible key-value pairs
}

export interface AppleHealthMeasurement {
  source: "apple_health_export"
  type: string  // "weight_kg", "systolic_bp", "diastolic_bp", "steps", etc.
  value: number
  unit: string
  timestamp: string  // ISO datetime
}

export interface HealthGuildData {
  version: "1.0.0"
  user_profile: UserProfile
  lab_history: LabSnapshot[]
  apple_health_measurements: AppleHealthMeasurement[]
}

// Evidence tiers for models
export type EvidenceTier = "well_supported" | "emerging" | "experimental"

// Model execution metadata
export interface ModelRan {
  name: string
  version: string
  status: "ok" | "warning"
  inputs_used: string[]
  evidence_tier: EvidenceTier
  result_summary: string
  raw_result: any
}

export interface ModelSkipped {
  name: string
  reason: "missing_inputs" | "out_of_range" | "not_applicable"
  missing_inputs?: string[]
  note?: string
}

// Domain types
export type HealthDomain = 
  | "metabolic" 
  | "lipid" 
  | "liver" 
  | "kidney" 
  | "inflammation" 
  | "nutrient"
  | "cardiorespiratory"
  | "overall"

export interface DomainScore {
  domain: HealthDomain
  score: number  // 0-100
  status: "strong" | "ok" | "borderline" | "concerning"
  rationale: string
}

export interface MarkerTrend {
  marker: string
  latest_value?: number | null
  latest_date?: string | null
  slope_per_year?: number | null
  direction: "improving" | "worsening" | "stable" | "insufficient_data"
  interpretation: string
  z_score_latest?: number | null
}

export interface Recommendation {
  type: "data_gap" | "trend_to_discuss" | "general_context"
  related_domain?: HealthDomain | null
  related_markers: string[]
  message: string
}

// Coverage types
export type CoverageLevel = "none" | "minimal" | "partial" | "good" | "excellent"

export interface CoverageDomain {
  domain: HealthDomain
  coverage_level: CoverageLevel
  key_markers_present: string[]
  key_markers_missing: string[]
  notes?: string | null
}

export interface CoverageModel {
  name: string
  status: "fully_supported" | "partially_supported" | "blocked"
  required_inputs: string[]
  available_inputs: string[]
  missing_inputs: string[]
  evidence_tier?: EvidenceTier | null
  note?: string | null
}

export type Obtainability = 
  | "self_measured" 
  | "primary_care_common" 
  | "primary_care_possible" 
  | "specialist_or_private"

export interface SuggestedAdditionalData {
  name: string
  category: "vital" | "basic_lab" | "expanded_lab" | "lifestyle"
  obtainability: Obtainability
  unlocks_models: string[]
  improves_domains: HealthDomain[]
  neutral_prompt: string
}
