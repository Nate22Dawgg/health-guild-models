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

// ============================================================================
// CANONICAL FLOW TYPES (for flows.generate_health_story)
// ============================================================================

/**
 * HealthTimeline - Canonical input format for flows
 * Everything the engine needs to know about a person's health journey
 */
export interface HealthTimeline {
  context: {
    age: number
    sex: "male" | "female" | "other" | "unknown"
    race?: string | null
    goals?: string[] | null  // e.g., ["longevity", "athletic_performance", "disease_prevention"]
    concerns?: string[] | null  // e.g., ["fatigue", "weight_gain", "family_history_diabetes"]
    conditions?: string[] | null  // e.g., ["hypertension", "hypothyroidism"]
    medications?: string[] | null
    lifestyle?: {
      smoker?: boolean | null
      alcohol_weekly_drinks?: number | null
      exercise_minutes_per_week?: number | null
      sleep_hours_per_night?: number | null
    }
  }
  labs: LabSnapshot[]  // Longitudinal lab data
  vitals?: {  // Latest vitals (or time-series if available)
    weight_kg?: number | null
    height_cm?: number | null
    systolic_bp?: number | null
    diastolic_bp?: number | null
    resting_heart_rate?: number | null
    timestamp?: string | null
  }
  wearables?: {  // Optional wearables data (Apple Health, Fitbit, etc.)
    avg_steps_per_day?: number | null
    avg_sleep_hours?: number | null
    avg_resting_hr?: number | null
    hrv_avg?: number | null
    vo2_max?: number | null
  }
  metadata: {
    created_at: string  // ISO timestamp
    updated_at: string
    version: string  // "1.0.0"
  }
}

/**
 * RiskSummary - Canonical output format from flows
 * Everything the UI needs to render a complete health story
 */
export interface RiskSummary {
  metrics: {
    overall_health_index: {
      score: number  // 0-100
      grade: "A" | "B" | "C" | "D" | "F"
      percentile?: number | null  // vs age/sex cohort
      narrative: string
    }
    ascvd_10yr_risk?: {
      risk_percent: number
      category: "low" | "borderline" | "intermediate" | "high"
      interpretation: string
    } | null
    metabolic_syndrome_score?: {
      criteria_met: number  // 0-5
      has_metabolic_syndrome: boolean
      interpretation: string
    } | null
    // Add other key metrics as needed
  }
  
  issues_ranked: Array<{
    priority: "critical" | "high" | "moderate" | "low"
    domain: HealthDomain
    title: string  // "Elevated LDL Cholesterol"
    summary: string  // "Your LDL is 160 mg/dL, above optimal (<100)"
    trend?: "improving" | "worsening" | "stable" | null
    actionable: boolean
    patient_friendly_explanation: string
  }>
  
  domain_summaries: Array<{
    domain: HealthDomain
    score: number  // 0-100
    status: "strong" | "ok" | "borderline" | "concerning"
    summary: string
    key_markers: Array<{
      name: string
      value: number
      unit: string
      status: "optimal" | "acceptable" | "borderline" | "concerning"
    }>
    trends?: MarkerTrend[]
  }>
  
  profile_coverage: {
    core_coverage_percent: number  // % of core markers present
    advanced_coverage_percent: number  // % of advanced markers present
    missing_by_domain: Array<{
      domain: HealthDomain
      missing_core: string[]
      missing_advanced: string[]
    }>
    suggested_additions: SuggestedAdditionalData[]
  }
  
  limitations: {
    missing_critical_data: boolean
    no_physical_exam: boolean
    no_imaging: boolean
    no_genetic_data: boolean
    recency_issues: Array<{
      marker: string
      last_measured: string
      age_days: number
    }>
    disclaimer: string
  }
  
  imputed_markers: Array<{
    marker_name: string
    predicted_value: number
    unit: string
    confidence: number
    category?: string
    interpretation: string
    evidence: {
      source: string
      doi?: string
      r_squared: number
    }
    ci_95?: [number, number]
    model_used: string
    actionable?: boolean
  }>
  
  mcp_call_log: Array<{
    tool: string
    phase: "metrics" | "domains" | "coverage" | "imputation" | "narrative"
    status: "success" | "partial" | "skipped" | "error"
    reason?: string | null
    input_summary: any
    output_summary: any
    execution_time_ms?: number | null
  }>
}

/**
 * HealthStory - Final output from flows.generate_health_story
 * Includes narratives generated by LLM based on RiskSummary
 */
export interface HealthStory {
  risk_summary: RiskSummary
  
  narratives: {
    patient_narrative: string  // Plain-English health story for the patient
    doctor_narrative: string  // Clinical summary for physician review
    visit_prep: {
      agenda_items: string[]  // What to discuss at next appointment
      questions_for_clinician: string[]  // Suggested questions to ask
      tests_to_request: string[]  // Labs/tests to consider ordering
    }
    profile_completeness_explanation: string  // Why certain markers are missing
  }
  
  generated_at: string  // ISO timestamp
  version: string  // "1.0.0"
}
