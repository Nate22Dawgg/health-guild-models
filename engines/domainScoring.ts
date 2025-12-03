/**
 * Domain Scoring Engine
 * Aggregates markers and model outputs into domain-specific health scores
 */

import { LabSnapshot, UserProfile, DomainScore, MarkerTrend } from '../types/health-data'

interface MarkerReference {
  optimal: number
  acceptable: number
  borderline: number
  concerning: number
  higherIsBetter: boolean
}

// Reference ranges (simplified - adjust based on clinical guidelines)
const MARKER_RANGES: Record<string, MarkerReference> = {
  // Metabolic markers
  'glucose': { optimal: 90, acceptable: 100, borderline: 110, concerning: 126, higherIsBetter: false },
  'hba1c': { optimal: 5.0, acceptable: 5.6, borderline: 6.0, concerning: 6.5, higherIsBetter: false },
  'fasting_insulin': { optimal: 5, acceptable: 10, borderline: 15, concerning: 25, higherIsBetter: false },
  
  // Lipid markers
  'total_chol': { optimal: 180, acceptable: 200, borderline: 220, concerning: 240, higherIsBetter: false },
  'ldl': { optimal: 100, acceptable: 130, borderline: 160, concerning: 190, higherIsBetter: false },
  'hdl': { optimal: 60, acceptable: 50, borderline: 40, concerning: 35, higherIsBetter: true },
  'triglycerides': { optimal: 100, acceptable: 150, borderline: 200, concerning: 500, higherIsBetter: false },
  
  // Liver markers
  'ast': { optimal: 20, acceptable: 30, borderline: 40, concerning: 60, higherIsBetter: false },
  'alt': { optimal: 20, acceptable: 35, borderline: 50, concerning: 80, higherIsBetter: false },
  'albumin': { optimal: 4.5, acceptable: 4.0, borderline: 3.5, concerning: 3.0, higherIsBetter: true },
  
  // Kidney markers
  'creatinine': { optimal: 0.9, acceptable: 1.1, borderline: 1.3, concerning: 1.5, higherIsBetter: false },
  'egfr': { optimal: 100, acceptable: 80, borderline: 60, concerning: 45, higherIsBetter: true },
  
  // Inflammation markers
  'hs_crp': { optimal: 1.0, acceptable: 2.0, borderline: 3.0, concerning: 10.0, higherIsBetter: false },
  
  // Nutrient markers
  'vitamin_d': { optimal: 50, acceptable: 30, borderline: 20, concerning: 12, higherIsBetter: true },
  'vitamin_b12': { optimal: 500, acceptable: 300, borderline: 200, concerning: 150, higherIsBetter: true },
  'ferritin': { optimal: 100, acceptable: 50, borderline: 20, concerning: 10, higherIsBetter: true },
}

/**
 * Score a single marker value (0-100)
 */
function scoreMarker(value: number, markerName: string): number {
  const ref = MARKER_RANGES[markerName.toLowerCase()]
  if (!ref) return 50  // Neutral if unknown marker

  const { optimal, acceptable, borderline, concerning, higherIsBetter } = ref

  if (higherIsBetter) {
    if (value >= optimal) return 100
    if (value >= acceptable) return 75 + (value - acceptable) / (optimal - acceptable) * 25
    if (value >= borderline) return 50 + (value - borderline) / (acceptable - borderline) * 25
    if (value >= concerning) return 25 + (value - concerning) / (borderline - concerning) * 25
    return Math.max(0, (value / concerning) * 25)
  } else {
    if (value <= optimal) return 100
    if (value <= acceptable) return 75 + (acceptable - value) / (acceptable - optimal) * 25
    if (value <= borderline) return 50 + (borderline - value) / (borderline - acceptable) * 25
    if (value <= concerning) return 25 + (concerning - value) / (concerning - borderline) * 25
    return Math.max(0, 25 - (value - concerning) / concerning * 25)
  }
}

/**
 * Get latest value for a marker from lab history
 */
function getLatestMarkerValue(labHistory: LabSnapshot[], marker: string): number | null {
  // Sort by date descending
  const sorted = [...labHistory].sort((a, b) => 
    new Date(b.date).getTime() - new Date(a.date).getTime()
  )

  for (const snapshot of sorted) {
    const value = snapshot.labs[marker]
    if (value != null) {
      return value
    }
  }

  return null
}

/**
 * Calculate metabolic domain score
 */
function calculateMetabolicScore(labHistory: LabSnapshot[], trends: MarkerTrend[]): DomainScore | null {
  const markers = ['glucose', 'hba1c', 'fasting_insulin']
  const scores: number[] = []

  markers.forEach(marker => {
    const value = getLatestMarkerValue(labHistory, marker)
    if (value !== null) {
      scores.push(scoreMarker(value, marker))
    }
  })

  if (scores.length === 0) return null

  const avgScore = scores.reduce((a, b) => a + b, 0) / scores.length

  let status: "strong" | "ok" | "borderline" | "concerning"
  if (avgScore >= 75) status = "strong"
  else if (avgScore >= 60) status = "ok"
  else if (avgScore >= 45) status = "borderline"
  else status = "concerning"

  let rationale = `Based on ${scores.length} metabolic marker${scores.length > 1 ? 's' : ''}.`
  
  // Check for improving trends
  const improvingMarkers = trends.filter(t => 
    markers.includes(t.marker) && t.direction === "improving"
  )
  if (improvingMarkers.length > 0) {
    rationale += ` Positive trend in ${improvingMarkers[0].marker}.`
  }

  return {
    domain: "metabolic",
    score: Math.round(avgScore),
    status,
    rationale
  }
}

/**
 * Calculate lipid domain score
 */
function calculateLipidScore(labHistory: LabSnapshot[], trends: MarkerTrend[]): DomainScore | null {
  const markers = ['total_chol', 'ldl', 'hdl', 'triglycerides']
  const scores: number[] = []

  markers.forEach(marker => {
    const value = getLatestMarkerValue(labHistory, marker)
    if (value !== null) {
      scores.push(scoreMarker(value, marker))
    }
  })

  if (scores.length === 0) return null

  const avgScore = scores.reduce((a, b) => a + b, 0) / scores.length

  let status: "strong" | "ok" | "borderline" | "concerning"
  if (avgScore >= 75) status = "strong"
  else if (avgScore >= 60) status = "ok"
  else if (avgScore >= 45) status = "borderline"
  else status = "concerning"

  return {
    domain: "lipid",
    score: Math.round(avgScore),
    status,
    rationale: `Based on ${scores.length} lipid marker${scores.length > 1 ? 's' : ''}.`
  }
}

/**
 * Calculate liver domain score
 */
function calculateLiverScore(labHistory: LabSnapshot[], trends: MarkerTrend[]): DomainScore | null {
  const markers = ['ast', 'alt', 'albumin']
  const scores: number[] = []

  markers.forEach(marker => {
    const value = getLatestMarkerValue(labHistory, marker)
    if (value !== null) {
      scores.push(scoreMarker(value, marker))
    }
  })

  if (scores.length === 0) return null

  const avgScore = scores.reduce((a, b) => a + b, 0) / scores.length

  let status: "strong" | "ok" | "borderline" | "concerning"
  if (avgScore >= 75) status = "strong"
  else if (avgScore >= 60) status = "ok"
  else if (avgScore >= 45) status = "borderline"
  else status = "concerning"

  return {
    domain: "liver",
    score: Math.round(avgScore),
    status,
    rationale: `Based on ${scores.length} liver marker${scores.length > 1 ? 's' : ''}.`
  }
}

/**
 * Calculate kidney domain score
 */
function calculateKidneyScore(labHistory: LabSnapshot[], trends: MarkerTrend[]): DomainScore | null {
  const markers = ['creatinine', 'egfr']
  const scores: number[] = []

  markers.forEach(marker => {
    const value = getLatestMarkerValue(labHistory, marker)
    if (value !== null) {
      scores.push(scoreMarker(value, marker))
    }
  })

  if (scores.length === 0) return null

  const avgScore = scores.reduce((a, b) => a + b, 0) / scores.length

  let status: "strong" | "ok" | "borderline" | "concerning"
  if (avgScore >= 75) status = "strong"
  else if (avgScore >= 60) status = "ok"
  else if (avgScore >= 45) status = "borderline"
  else status = "concerning"

  return {
    domain: "kidney",
    score: Math.round(avgScore),
    status,
    rationale: `Based on ${scores.length} kidney marker${scores.length > 1 ? 's' : ''}.`
  }
}

/**
 * Calculate inflammation domain score
 */
function calculateInflammationScore(labHistory: LabSnapshot[], trends: MarkerTrend[]): DomainScore | null {
  const markers = ['hs_crp']
  const scores: number[] = []

  markers.forEach(marker => {
    const value = getLatestMarkerValue(labHistory, marker)
    if (value !== null) {
      scores.push(scoreMarker(value, marker))
    }
  })

  if (scores.length === 0) return null

  const avgScore = scores.reduce((a, b) => a + b, 0) / scores.length

  let status: "strong" | "ok" | "borderline" | "concerning"
  if (avgScore >= 75) status = "strong"
  else if (avgScore >= 60) status = "ok"
  else if (avgScore >= 45) status = "borderline"
  else status = "concerning"

  return {
    domain: "inflammation",
    score: Math.round(avgScore),
    status,
    rationale: `Based on inflammation markers.`
  }
}

/**
 * Calculate nutrient domain score
 */
function calculateNutrientScore(labHistory: LabSnapshot[], trends: MarkerTrend[]): DomainScore | null {
  const markers = ['vitamin_d', 'vitamin_b12', 'ferritin']
  const scores: number[] = []

  markers.forEach(marker => {
    const value = getLatestMarkerValue(labHistory, marker)
    if (value !== null) {
      scores.push(scoreMarker(value, marker))
    }
  })

  if (scores.length === 0) return null

  const avgScore = scores.reduce((a, b) => a + b, 0) / scores.length

  let status: "strong" | "ok" | "borderline" | "concerning"
  if (avgScore >= 75) status = "strong"
  else if (avgScore >= 60) status = "ok"
  else if (avgScore >= 45) status = "borderline"
  else status = "concerning"

  return {
    domain: "nutrient",
    score: Math.round(avgScore),
    status,
    rationale: `Based on ${scores.length} nutrient marker${scores.length > 1 ? 's' : ''}.`
  }
}

/**
 * Calculate all domain scores
 */
export function calculateDomainScores(
  userProfile: UserProfile,
  labHistory: LabSnapshot[],
  trends: MarkerTrend[]
): DomainScore[] {
  const domains: (DomainScore | null)[] = [
    calculateMetabolicScore(labHistory, trends),
    calculateLipidScore(labHistory, trends),
    calculateLiverScore(labHistory, trends),
    calculateKidneyScore(labHistory, trends),
    calculateInflammationScore(labHistory, trends),
    calculateNutrientScore(labHistory, trends)
  ]

  return domains.filter(d => d !== null) as DomainScore[]
}
