/**
 * Coverage Analysis Engine
 * Analyzes data coverage and suggests additional data to unlock more models
 */

import { 
  CoverageDomain, 
  CoverageModel, 
  SuggestedAdditionalData,
  CoverageLevel,
  EvidenceTier
} from '../types/health-data'

// Domain marker requirements
const DOMAIN_MARKERS: Record<string, { key: string[], optional: string[] }> = {
  metabolic: {
    key: ['glucose', 'hba1c'],
    optional: ['fasting_insulin']
  },
  lipid: {
    key: ['total_chol', 'ldl', 'hdl'],
    optional: ['triglycerides']
  },
  liver: {
    key: ['ast', 'alt'],
    optional: ['albumin', 'platelets']
  },
  kidney: {
    key: ['creatinine'],
    optional: ['egfr']
  },
  inflammation: {
    key: ['hs_crp'],
    optional: []
  },
  nutrient: {
    key: ['vitamin_d'],
    optional: ['vitamin_b12', 'ferritin']
  }
}

// Model requirements
const MODEL_REQUIREMENTS: Record<string, {
  required: string[]
  optional: string[]
  evidence_tier: EvidenceTier
}> = {
  'ASCVD_10YR': {
    required: ['age', 'sex', 'race', 'total_chol', 'hdl', 'systolic_bp', 'smoker', 'diabetic', 'on_bp_meds'],
    optional: [],
    evidence_tier: 'well_supported'
  },
  'FIB4': {
    required: ['age', 'ast', 'alt', 'platelets'],
    optional: [],
    evidence_tier: 'well_supported'
  },
  'NAFLD': {
    required: ['age', 'bmi', 'diabetic', 'ast', 'alt', 'platelets', 'albumin'],
    optional: [],
    evidence_tier: 'well_supported'
  },
  'EGFR_CKD_EPI_2021': {
    required: ['age', 'sex', 'creatinine'],
    optional: [],
    evidence_tier: 'well_supported'
  },
  'CKD_STAGE': {
    required: ['egfr'],
    optional: [],
    evidence_tier: 'well_supported'
  },
  'HOMA_IR': {
    required: ['fasting_glucose', 'fasting_insulin'],
    optional: [],
    evidence_tier: 'emerging'
  }
}

/**
 * Calculate coverage level based on available markers
 */
function calculateCoverageLevel(
  keyMarkersPresent: number,
  keyMarkersTotal: number,
  optionalMarkersPresent: number,
  optionalMarkersTotal: number
): CoverageLevel {
  const keyPercent = keyMarkersTotal > 0 ? keyMarkersPresent / keyMarkersTotal : 0
  const optionalPercent = optionalMarkersTotal > 0 ? optionalMarkersPresent / optionalMarkersTotal : 0
  const totalPercent = (keyPercent * 0.7) + (optionalPercent * 0.3)

  if (keyPercent === 0) return "none"
  if (totalPercent >= 0.8) return "excellent"
  if (totalPercent >= 0.6) return "good"
  if (totalPercent >= 0.4) return "partial"
  return "minimal"
}

/**
 * Analyze domain coverage
 */
export function analyzeDomainCoverage(
  labsAvailable: string[],
  vitalsAvailable: string[]
): CoverageDomain[] {
  const allAvailable = [...labsAvailable, ...vitalsAvailable]
  const domains: CoverageDomain[] = []

  Object.entries(DOMAIN_MARKERS).forEach(([domainName, requirements]) => {
    const keyPresent = requirements.key.filter(m => 
      allAvailable.some(a => a.toLowerCase() === m.toLowerCase())
    )
    const optionalPresent = requirements.optional.filter(m =>
      allAvailable.some(a => a.toLowerCase() === m.toLowerCase())
    )

    const keyMissing = requirements.key.filter(m => !keyPresent.includes(m))
    const optionalMissing = requirements.optional.filter(m => !optionalPresent.includes(m))

    const coverageLevel = calculateCoverageLevel(
      keyPresent.length,
      requirements.key.length,
      optionalPresent.length,
      requirements.optional.length
    )

    let notes: string | null = null
    if (coverageLevel === "none") {
      notes = `Add ${keyMissing[0]} to start tracking ${domainName} health.`
    } else if (coverageLevel === "minimal" || coverageLevel === "partial") {
      notes = `Add ${keyMissing.concat(optionalMissing).slice(0, 2).join(', ')} for better coverage.`
    }

    domains.push({
      domain: domainName as any,
      coverage_level: coverageLevel,
      key_markers_present: keyPresent,
      key_markers_missing: keyMissing.concat(optionalMissing),
      notes
    })
  })

  return domains
}

/**
 * Analyze model coverage
 */
export function analyzeModelCoverage(
  userProfile: any,
  labsAvailable: string[],
  vitalsAvailable: string[]
): CoverageModel[] {
  const allAvailable = new Set([
    ...Object.keys(userProfile || {}).filter(k => userProfile[k] != null),
    ...labsAvailable.map(m => m.toLowerCase()),
    ...vitalsAvailable.map(m => m.toLowerCase())
  ])

  const models: CoverageModel[] = []

  Object.entries(MODEL_REQUIREMENTS).forEach(([modelName, requirements]) => {
    const requiredLower = requirements.required.map(r => r.toLowerCase())
    const availableInputs = requiredLower.filter(r => allAvailable.has(r))
    const missingInputs = requiredLower.filter(r => !allAvailable.has(r))

    let status: "fully_supported" | "partially_supported" | "blocked"
    if (missingInputs.length === 0) {
      status = "fully_supported"
    } else if (availableInputs.length > 0) {
      status = "partially_supported"
    } else {
      status = "blocked"
    }

    let note: string | null = null
    if (status === "blocked") {
      note = `Requires: ${missingInputs.slice(0, 3).join(', ')}`
    } else if (status === "partially_supported") {
      note = `Missing: ${missingInputs.slice(0, 2).join(', ')}`
    }

    models.push({
      name: modelName,
      status,
      required_inputs: requirements.required,
      available_inputs: availableInputs,
      missing_inputs: missingInputs,
      evidence_tier: requirements.evidence_tier,
      note
    })
  })

  return models
}

/**
 * Suggest additional data to collect
 */
export function suggestAdditionalData(
  modelCoverage: CoverageModel[],
  domainCoverage: CoverageDomain[]
): SuggestedAdditionalData[] {
  const suggestions: SuggestedAdditionalData[] = []

  // Fasting insulin (unlocks HOMA-IR)
  const homaModel = modelCoverage.find(m => m.name === 'HOMA_IR')
  if (homaModel && homaModel.status !== 'fully_supported') {
    if (homaModel.missing_inputs.includes('fasting_insulin')) {
      suggestions.push({
        name: 'Fasting Insulin',
        category: 'basic_lab',
        obtainability: 'primary_care_common',
        unlocks_models: ['HOMA_IR'],
        improves_domains: ['metabolic'],
        neutral_prompt: "I'd like to understand my insulin resistance. Could we add fasting insulin to my next blood work?"
      })
    }
  }

  // HbA1c (metabolic tracking)
  const metabolicDomain = domainCoverage.find(d => d.domain === 'metabolic')
  if (metabolicDomain && !metabolicDomain.key_markers_present.includes('hba1c')) {
    suggestions.push({
      name: 'HbA1c',
      category: 'basic_lab',
      obtainability: 'primary_care_common',
      unlocks_models: [],
      improves_domains: ['metabolic'],
      neutral_prompt: "Could we check my HbA1c to get a 3-month average of my blood sugar levels?"
    })
  }

  // hs-CRP (inflammation)
  const inflammationDomain = domainCoverage.find(d => d.domain === 'inflammation')
  if (inflammationDomain && inflammationDomain.coverage_level === 'none') {
    suggestions.push({
      name: 'hs-CRP',
      category: 'expanded_lab',
      obtainability: 'primary_care_possible',
      unlocks_models: [],
      improves_domains: ['inflammation'],
      neutral_prompt: "I'm interested in tracking inflammation. Could we add hs-CRP to my labs?"
    })
  }

  // Vitamin D (nutrient optimization)
  const nutrientDomain = domainCoverage.find(d => d.domain === 'nutrient')
  if (nutrientDomain && !nutrientDomain.key_markers_present.includes('vitamin_d')) {
    suggestions.push({
      name: 'Vitamin D',
      category: 'basic_lab',
      obtainability: 'primary_care_common',
      unlocks_models: [],
      improves_domains: ['nutrient'],
      neutral_prompt: "Could we check my vitamin D levels to make sure I'm not deficient?"
    })
  }

  // Lipid panel (if incomplete)
  const lipidDomain = domainCoverage.find(d => d.domain === 'lipid')
  if (lipidDomain && lipidDomain.coverage_level === 'none') {
    suggestions.push({
      name: 'Lipid Panel',
      category: 'basic_lab',
      obtainability: 'primary_care_common',
      unlocks_models: ['ASCVD_10YR'],
      improves_domains: ['lipid'],
      neutral_prompt: "Could we check my cholesterol levels with a full lipid panel?"
    })
  }

  // Blood pressure (vital)
  if (!suggestions.some(s => s.name.includes('Blood Pressure'))) {
    suggestions.push({
      name: 'Blood Pressure',
      category: 'vital',
      obtainability: 'self_measured',
      unlocks_models: ['ASCVD_10YR'],
      improves_domains: ['cardiorespiratory'],
      neutral_prompt: "I'd like to track my blood pressure at home. What should I look for in a monitor?"
    })
  }

  return suggestions
}
