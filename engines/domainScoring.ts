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
  
  // Liver markers (all 6 markers used)
  'ast': { optimal: 20, acceptable: 30, borderline: 40, concerning: 60, higherIsBetter: false },
  'alt': { optimal: 20, acceptable: 35, borderline: 50, concerning: 80, higherIsBetter: false },
  'albumin': { optimal: 4.5, acceptable: 4.0, borderline: 3.5, concerning: 3.0, higherIsBetter: true },
  'bilirubin': { optimal: 0.5, acceptable: 1.0, borderline: 1.5, concerning: 2.5, higherIsBetter: false },
  'alp': { optimal: 70, acceptable: 100, borderline: 130, concerning: 200, higherIsBetter: false },
  'ggt': { optimal: 25, acceptable: 40, borderline: 60, concerning: 100, higherIsBetter: false },
  
  // Kidney markers (all 3 markers used)
  'creatinine': { optimal: 0.9, acceptable: 1.1, borderline: 1.3, concerning: 1.5, higherIsBetter: false },
  'bun': { optimal: 15, acceptable: 20, borderline: 25, concerning: 40, higherIsBetter: false },
  'egfr': { optimal: 100, acceptable: 80, borderline: 60, concerning: 45, higherIsBetter: true },
  
  // Blood pressure
  'systolic_bp': { optimal: 120, acceptable: 130, borderline: 140, concerning: 160, higherIsBetter: false },
  'diastolic_bp': { optimal: 80, acceptable: 85, borderline: 90, concerning: 100, higherIsBetter: false },
  
  // Blood count
  'platelets': { optimal: 250, acceptable: 200, borderline: 150, concerning: 100, higherIsBetter: true },
  
  // Inflammation markers
  'hs_crp': { optimal: 1.0, acceptable: 2.0, borderline: 3.0, concerning: 10.0, higherIsBetter: false },
  
  // Nutrient markers (all 3 markers used)
  'vitamin_d': { optimal: 50, acceptable: 30, borderline: 20, concerning: 12, higherIsBetter: true },
  'vitamin_b12': { optimal: 500, acceptable: 300, borderline: 200, concerning: 150, higherIsBetter: true },
  'ferritin': { optimal: 100, acceptable: 50, borderline: 20, concerning: 10, higherIsBetter: true },
  
  // Thyroid markers (all 5 markers used)
  'tsh': { optimal: 1.5, acceptable: 2.5, borderline: 4.0, concerning: 10.0, higherIsBetter: false },
  'free_t3': { optimal: 3.5, acceptable: 3.0, borderline: 2.5, concerning: 2.0, higherIsBetter: true },
  'free_t4': { optimal: 1.3, acceptable: 1.0, borderline: 0.8, concerning: 0.6, higherIsBetter: true },
  'reverse_t3': { optimal: 15, acceptable: 20, borderline: 25, concerning: 30, higherIsBetter: false },
  'tpo_antibodies': { optimal: 0, acceptable: 9, borderline: 35, concerning: 100, higherIsBetter: false },
  
  // Hormone markers (sex hormones - ranges simplified, sex-specific logic in domain scoring)
  'total_testosterone': { optimal: 600, acceptable: 400, borderline: 300, concerning: 200, higherIsBetter: true },
  'free_testosterone': { optimal: 100, acceptable: 50, borderline: 30, concerning: 15, higherIsBetter: true },
  'estradiol': { optimal: 25, acceptable: 40, borderline: 60, concerning: 80, higherIsBetter: false },  // Male-centric, adjusted in domain logic
  'progesterone': { optimal: 10, acceptable: 5, borderline: 2, concerning: 1, higherIsBetter: true },  // Luteal phase
  'shbg': { optimal: 40, acceptable: 30, borderline: 20, concerning: 10, higherIsBetter: true },
  'dhea_s': { optimal: 300, acceptable: 150, borderline: 75, concerning: 40, higherIsBetter: true },
  'cortisol': { optimal: 15, acceptable: 20, borderline: 25, concerning: 30, higherIsBetter: false },  // Morning
  
  // Hematology markers (CBC - Complete Blood Count)
  'wbc': { optimal: 7.0, acceptable: 6.0, borderline: 4.5, concerning: 3.5, higherIsBetter: true },  // × 10^9/L
  'rbc': { optimal: 5.0, acceptable: 4.5, borderline: 4.0, concerning: 3.5, higherIsBetter: true },  // × 10^12/L
  'hemoglobin': { optimal: 15.0, acceptable: 13.5, borderline: 12.0, concerning: 10.0, higherIsBetter: true },  // g/dL (simplified)
  'hematocrit': { optimal: 45, acceptable: 40, borderline: 36, concerning: 32, higherIsBetter: true },  // %
  'mcv': { optimal: 90, acceptable: 85, borderline: 80, concerning: 75, higherIsBetter: true },  // fL
  'mch': { optimal: 30, acceptable: 28, borderline: 27, concerning: 25, higherIsBetter: true },  // pg
  'mchc': { optimal: 34, acceptable: 33, borderline: 32, concerning: 30, higherIsBetter: true },  // g/dL
  'rdw': { optimal: 13, acceptable: 14, borderline: 15, concerning: 17, higherIsBetter: false },  // %
  
  // Advanced Lipids (better CV risk assessment than standard lipids)
  'apob': { optimal: 80, acceptable: 90, borderline: 110, concerning: 130, higherIsBetter: false },  // mg/dL
  'lp_a': { optimal: 30, acceptable: 50, borderline: 75, concerning: 100, higherIsBetter: false },  // mg/dL (genetic)
  'ldl_p': { optimal: 1000, acceptable: 1300, borderline: 1600, concerning: 2000, higherIsBetter: false },  // nmol/L
  
  // Electrolytes
  'sodium': { optimal: 140, acceptable: 138, borderline: 136, concerning: 133, higherIsBetter: true },  // mEq/L
  'potassium': { optimal: 4.2, acceptable: 3.8, borderline: 3.5, concerning: 3.2, higherIsBetter: true },  // mEq/L
  'chloride': { optimal: 102, acceptable: 100, borderline: 98, concerning: 95, higherIsBetter: true },  // mEq/L
  'co2': { optimal: 26, acceptable: 24, borderline: 23, concerning: 20, higherIsBetter: true },  // mEq/L
  
  // Bone Health markers
  'calcium': { optimal: 9.5, acceptable: 9.0, borderline: 8.5, concerning: 8.0, higherIsBetter: true },  // mg/dL
  'phosphorus': { optimal: 3.5, acceptable: 3.0, borderline: 2.5, concerning: 2.0, higherIsBetter: true },  // mg/dL
  'pth': { optimal: 35, acceptable: 45, borderline: 60, concerning: 80, higherIsBetter: false },  // pg/mL (Parathyroid Hormone)
  // Note: vitamin_d and alp already defined above
  
  // Iron Panel markers
  'serum_iron': { optimal: 100, acceptable: 70, borderline: 50, concerning: 30, higherIsBetter: true },  // μg/dL
  'tibc': { optimal: 310, acceptable: 340, borderline: 370, concerning: 420, higherIsBetter: false },  // μg/dL (Total Iron Binding Capacity)
  'transferrin_saturation': { optimal: 35, acceptable: 25, borderline: 18, concerning: 12, higherIsBetter: true },  // % (calculated: serum_iron/tibc * 100)
  // Note: ferritin already defined above
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
  
  // Add HOMA-IR context (insulin resistance detection)
  const latestLabs = labHistory[labHistory.length - 1]?.labs
  if (latestLabs?.glucose && latestLabs?.fasting_insulin) {
    const homaIR = (latestLabs.glucose * latestLabs.fasting_insulin) / 405.0
    if (homaIR > 2.0) {
      rationale += ` Elevated HOMA-IR (${homaIR.toFixed(2)}) indicates insulin resistance.`
      if (status === 'strong') status = 'ok'
    } else if (homaIR < 1.0) {
      rationale += ` Excellent insulin sensitivity (HOMA-IR ${homaIR.toFixed(2)}).`
    }
  }

  // Add hyperinsulinemia detection
  if (latestLabs?.fasting_insulin && latestLabs.fasting_insulin > 15) {
    rationale += ' Elevated fasting insulin suggests hyperinsulinemia.'
  }
  
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

  let rationale = `Based on ${scores.length} lipid marker${scores.length > 1 ? 's' : ''}.`

  // Add TG/HDL ratio interpretation (insulin resistance marker)
  const latestLabs = labHistory[labHistory.length - 1]?.labs
  if (latestLabs?.triglycerides && latestLabs?.hdl) {
    const tgHdlRatio = latestLabs.triglycerides / latestLabs.hdl
    if (tgHdlRatio > 3.0) {
      rationale += ` Elevated TG/HDL ratio (${tgHdlRatio.toFixed(2)}) indicates insulin resistance and increased CV risk.`
      if (status === 'strong') status = 'ok'
    } else if (tgHdlRatio < 2.0) {
      rationale += ` Optimal TG/HDL ratio (${tgHdlRatio.toFixed(2)}) - low insulin resistance risk.`
    }
  }

  // Add Non-HDL cholesterol interpretation (ACC/AHA guidelines)
  if (latestLabs?.total_chol && latestLabs?.hdl) {
    const nonHDL = latestLabs.total_chol - latestLabs.hdl
    if (nonHDL >= 160) {
      rationale += ` Elevated Non-HDL cholesterol (${nonHDL} mg/dL) - all atherogenic particles increased.`
    } else if (nonHDL < 130) {
      rationale += ` Optimal Non-HDL cholesterol (${nonHDL} mg/dL).`
    }
  }

  return {
    domain: "lipid",
    score: Math.round(avgScore),
    status,
    rationale
  }
}

/**
 * Calculate liver domain score
 */
function calculateLiverScore(labHistory: LabSnapshot[], trends: MarkerTrend[]): DomainScore | null {
  const markers = ['ast', 'alt', 'albumin', 'bilirubin', 'alp', 'ggt']
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

  let rationale = `Based on ${scores.length} liver marker${scores.length > 1 ? 's' : ''}.`

  // Add AST/ALT ratio interpretation (De Ritis ratio - clinical gold standard)
  const latestLabs = labHistory[labHistory.length - 1]?.labs
  if (latestLabs?.ast && latestLabs?.alt) {
    const astAltRatio = latestLabs.ast / latestLabs.alt
    if (astAltRatio > 2.0) {
      rationale += ' Elevated AST/ALT ratio (>2.0) suggests alcoholic liver disease or advanced cirrhosis.'
      if (avgScore >= 60) {
        status = avgScore >= 75 ? 'ok' : 'borderline'
      }
    } else if (astAltRatio < 0.8) {
      rationale += ' Low AST/ALT ratio (<0.8) suggests NAFLD or chronic viral hepatitis.'
    }
  }

  // Add cholestasis detection (ALP + GGT pattern)
  if (latestLabs?.alp && latestLabs?.ggt) {
    if (latestLabs.alp > 130 && latestLabs.ggt > 60) {
      rationale += ' Elevated ALP and GGT suggest cholestasis (bile duct obstruction).'
      if (status === 'strong') status = 'ok'
    } else if (latestLabs.ggt > 60) {
      rationale += ' Elevated GGT may indicate alcohol use, bile duct problems, or fatty liver.'
    }
  }

  // Add bilirubin context
  if (latestLabs?.bilirubin && latestLabs.bilirubin > 1.5) {
    rationale += ' Elevated bilirubin may indicate liver dysfunction or hemolysis.'
  }

  return {
    domain: "liver",
    score: Math.round(avgScore),
    status,
    rationale
  }
}

/**
 * Calculate kidney domain score
 */
function calculateKidneyScore(labHistory: LabSnapshot[], trends: MarkerTrend[]): DomainScore | null {
  const markers = ['creatinine', 'bun', 'egfr']
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

  let rationale = `Based on ${scores.length} kidney marker${scores.length > 1 ? 's' : ''}.`

  // Add BUN/Creatinine ratio interpretation (clinical context)
  const latestLabs = labHistory[labHistory.length - 1]?.labs
  if (latestLabs?.bun && latestLabs?.creatinine) {
    const bunCrRatio = latestLabs.bun / latestLabs.creatinine
    if (bunCrRatio > 20) {
      rationale += ' Elevated BUN/Cr ratio suggests prerenal azotemia (dehydration, heart failure) or high protein intake.'
      if (avgScore >= 60) {
        // Downgrade if ratio is concerning
        status = avgScore >= 75 ? 'ok' : 'borderline'
      }
    } else if (bunCrRatio < 10) {
      rationale += ' Low BUN/Cr ratio may indicate intrinsic kidney disease or low protein intake.'
    } else {
      rationale += ' Normal BUN/Cr ratio indicates good hydration and kidney function.'
    }
  }

  return {
    domain: "kidney",
    score: Math.round(avgScore),
    status,
    rationale
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

  let rationale = `Based on inflammation markers.`

  // Add hs-CRP cardiovascular risk interpretation (clinically validated)
  const latestLabs = labHistory[labHistory.length - 1]?.labs
  if (latestLabs?.hs_crp) {
    const hsCRP = latestLabs.hs_crp
    if (hsCRP < 1.0) {
      rationale += ' Low hs-CRP indicates minimal systemic inflammation and low CV risk.'
    } else if (hsCRP < 3.0) {
      rationale += ' Moderate hs-CRP suggests average systemic inflammation and moderate CV risk.'
    } else if (hsCRP < 10.0) {
      rationale += ' Elevated hs-CRP indicates significant inflammation and increased CV risk.'
    } else {
      rationale += ' Very high hs-CRP (>10 mg/L) suggests acute inflammation or infection.'
    }
  }

  return {
    domain: "inflammation",
    score: Math.round(avgScore),
    status,
    rationale
  }
}

/**
 * Calculate nutrient domain score
 */
function calculateNutrientScore(labHistory: LabSnapshot[], trends: MarkerTrend[]): DomainScore | null {
  const markers = ['vitamin_d', 'vitamin_b12', 'ferritin']
  const scores: number[] = []
  const deficiencies: string[] = []

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

  let rationale = `Based on ${scores.length} nutrient marker${scores.length > 1 ? 's' : ''}.`

  // Add clinical interpretations for each nutrient (evidence-based ranges)
  const latestLabs = labHistory[labHistory.length - 1]?.labs
  
  // Vitamin D interpretation (Endocrine Society guidelines)
  if (latestLabs?.vitamin_d) {
    const vitD = latestLabs.vitamin_d
    if (vitD < 20) {
      deficiencies.push('Vitamin D')
      rationale += ' Vitamin D deficiency (<20 ng/mL) - bone health and immune function at risk.'
    } else if (vitD < 30) {
      rationale += ' Vitamin D insufficiency (20-30 ng/mL) - consider supplementation.'
    } else if (vitD >= 50) {
      rationale += ' Optimal Vitamin D levels (≥50 ng/mL).'
    }
  }

  // Vitamin B12 interpretation (clinical thresholds)
  if (latestLabs?.vitamin_b12) {
    const b12 = latestLabs.vitamin_b12
    if (b12 < 200) {
      deficiencies.push('B12')
      rationale += ' B12 deficiency (<200 pg/mL) - neurological and cognitive function at risk.'
    } else if (b12 < 300) {
      rationale += ' Low-normal B12 (200-300 pg/mL) - monitor for symptoms.'
    } else if (b12 >= 500) {
      rationale += ' Optimal B12 levels (≥500 pg/mL).'
    }
  }

  // Ferritin interpretation (iron stores)
  if (latestLabs?.ferritin) {
    const ferritin = latestLabs.ferritin
    if (ferritin < 20) {
      deficiencies.push('Iron')
      rationale += ' Iron deficiency (ferritin <20 ng/mL) - anemia risk.'
    } else if (ferritin < 50) {
      rationale += ' Low iron stores (ferritin 20-50 ng/mL) - suboptimal for performance.'
    } else if (ferritin > 300) {
      rationale += ' Elevated ferritin (>300 ng/mL) may indicate inflammation or iron overload.'
    } else if (ferritin >= 100) {
      rationale += ' Optimal iron stores (ferritin ≥100 ng/mL).'
    }
  }

  // Adjust status if multiple deficiencies
  if (deficiencies.length >= 2) {
    status = 'concerning'
  } else if (deficiencies.length === 1 && status === 'strong') {
    status = 'ok'
  }

  return {
    domain: "nutrient",
    score: Math.round(avgScore),
    status,
    rationale
  }
}

/**
 * Calculate thyroid domain score
 */
function calculateThyroidScore(labHistory: LabSnapshot[], trends: MarkerTrend[]): DomainScore | null {
  const markers = ['tsh', 'free_t3', 'free_t4', 'reverse_t3', 'tpo_antibodies']
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

  let rationale = `Based on ${scores.length} thyroid marker${scores.length > 1 ? 's' : ''}.`

  // Add thyroid function interpretation
  const latestLabs = labHistory[labHistory.length - 1]?.labs
  if (latestLabs?.tsh) {
    const tsh = latestLabs.tsh
    if (tsh > 4.0) {
      rationale += ' Elevated TSH suggests hypothyroidism (underactive thyroid).'
      if (status === 'strong') status = 'ok'
    } else if (tsh < 0.4) {
      rationale += ' Suppressed TSH suggests hyperthyroidism (overactive thyroid).'
      if (status === 'strong') status = 'ok'
    } else if (tsh >= 1.0 && tsh <= 2.5) {
      rationale += ' TSH in optimal range for longevity.'
    }
  }

  // Add T3/T4 ratio interpretation
  if (latestLabs?.free_t3 && latestLabs?.free_t4) {
    const t3t4Ratio = latestLabs.free_t3 / (latestLabs.free_t4 * 10)
    if (t3t4Ratio < 0.25) {
      rationale += ' Low T3:T4 ratio suggests poor T4-to-T3 conversion.'
    } else if (t3t4Ratio > 0.35) {
      rationale += ' High T3:T4 ratio may indicate excessive conversion or supplementation.'
    }
  }

  // Add TPO antibodies interpretation
  if (latestLabs?.tpo_antibodies && latestLabs.tpo_antibodies > 35) {
    rationale += ' Elevated TPO antibodies indicate autoimmune thyroid disease (Hashimoto\'s).'
    if (status === 'strong' || status === 'ok') status = 'borderline'
  }

  return {
    domain: "thyroid",
    score: Math.round(avgScore),
    status,
    rationale
  }
}

/**
 * Calculate hormone domain score (sex hormones and adrenal function)
 */
function calculateHormoneScore(labHistory: LabSnapshot[], trends: MarkerTrend[], userProfile?: UserProfile): DomainScore | null {
  // Hormone markers: total_testosterone, free_testosterone, estradiol, progesterone, shbg, dhea_s, cortisol
  const hormoneMarkers = ['total_testosterone', 'free_testosterone', 'estradiol', 'progesterone', 'shbg', 'dhea_s', 'cortisol']
  
  const latestLabs = labHistory[labHistory.length - 1]?.labs
  const availableMarkers = hormoneMarkers.filter(m => latestLabs?.[m as keyof typeof latestLabs] !== undefined)
  
  if (availableMarkers.length === 0) return null

  let totalScore = 0
  let count = 0
  let rationale = `Based on ${availableMarkers.length} hormone marker${availableMarkers.length > 1 ? 's' : ''}.`

  // Score each available marker
  availableMarkers.forEach(marker => {
    const score = scoreMarker(getLatestMarkerValue(labHistory, marker), marker)
    if (score !== null) {
      totalScore += score
      count++
    }
  })

  const avgScore = count > 0 ? totalScore / count : 75

  // Determine status
  let status: 'strong' | 'ok' | 'borderline' | 'concerning' = 'strong'
  if (avgScore < 45) status = 'concerning'
  else if (avgScore < 60) status = 'borderline'
  else if (avgScore < 75) status = 'ok'

  // Add sex-specific interpretations
  const sex = userProfile?.sex
  
  if (sex === 'male' && latestLabs?.total_testosterone) {
    if (latestLabs.total_testosterone < 300) {
      rationale += ' Low testosterone (<300 ng/dL) indicates hypogonadism.'
      if (status === 'strong' || status === 'ok') status = 'borderline'
    } else if (latestLabs.total_testosterone >= 500 && latestLabs.total_testosterone <= 900) {
      rationale += ' Testosterone in optimal range for male vitality.'
    }
  }

  if (sex === 'female' && latestLabs?.total_testosterone && latestLabs.total_testosterone > 70) {
    rationale += ' Elevated testosterone may indicate PCOS.'
    if (status === 'strong' || status === 'ok') status = 'borderline'
  }

  // DHEA-S interpretation (longevity marker)
  if (latestLabs?.dhea_s) {
    const age = userProfile?.age || 50
    const expectedMin = sex === 'male' ? (age < 40 ? 280 : age < 60 ? 120 : 40) : (age < 40 ? 65 : age < 60 ? 45 : 20)
    
    if (latestLabs.dhea_s < expectedMin * 0.5) {
      rationale += ' Very low DHEA-S suggests adrenal insufficiency or accelerated aging.'
      if (status === 'strong' || status === 'ok') status = 'borderline'
    }
  }

  // Cortisol interpretation (stress marker)
  if (latestLabs?.cortisol) {
    if (latestLabs.cortisol < 5) {
      rationale += ' Low morning cortisol may indicate adrenal fatigue.'
      if (status === 'strong' || status === 'ok') status = 'borderline'
    } else if (latestLabs.cortisol > 20) {
      rationale += ' Elevated cortisol suggests chronic stress.'
      if (status === 'strong' || status === 'ok') status = 'borderline'
    }
  }

  return {
    domain: "hormone",
    score: Math.round(avgScore),
    status,
    rationale
  }
}

/**
 * Calculate hematology domain score (Complete Blood Count)
 */
function calculateHematologyScore(labHistory: LabSnapshot[], trends: MarkerTrend[], userProfile?: UserProfile): DomainScore | null {
  // CBC markers: wbc, rbc, hemoglobin, hematocrit, mcv, mch, mchc, rdw
  const cbcMarkers = ['wbc', 'rbc', 'hemoglobin', 'hematocrit', 'mcv', 'mch', 'mchc', 'rdw']
  
  const latestLabs = labHistory[labHistory.length - 1]?.labs
  const availableMarkers = cbcMarkers.filter(m => latestLabs?.[m as keyof typeof latestLabs] !== undefined)
  
  if (availableMarkers.length === 0) return null

  let totalScore = 0
  let count = 0
  let rationale = `Based on ${availableMarkers.length} CBC marker${availableMarkers.length > 1 ? 's' : ''}.`

  // Score each available marker
  availableMarkers.forEach(marker => {
    const score = scoreMarker(getLatestMarkerValue(labHistory, marker), marker)
    if (score !== null) {
      totalScore += score
      count++
    }
  })

  const avgScore = count > 0 ? totalScore / count : 75

  // Determine status
  let status: 'strong' | 'ok' | 'borderline' | 'concerning' = 'strong'
  if (avgScore < 45) status = 'concerning'
  else if (avgScore < 60) status = 'borderline'
  else if (avgScore < 75) status = 'ok'

  // Anemia detection (hemoglobin)
  const sex = userProfile?.sex
  if (latestLabs?.hemoglobin) {
    const threshold = sex === 'male' ? 13 : 12
    if (latestLabs.hemoglobin < threshold) {
      rationale += ` Anemia detected (Hgb ${latestLabs.hemoglobin} g/dL).`
      if (status === 'strong' || status === 'ok') status = 'borderline'
      
      // Classify anemia by MCV
      if (latestLabs?.mcv) {
        if (latestLabs.mcv < 80) {
          rationale += ' Microcytic anemia suggests iron deficiency.'
        } else if (latestLabs.mcv > 100) {
          rationale += ' Macrocytic anemia suggests B12/folate deficiency.'
        } else {
          rationale += ' Normocytic anemia suggests chronic disease or blood loss.'
        }
      }
    }
  }

  // High WBC (infection/inflammation)
  if (latestLabs?.wbc && latestLabs.wbc > 11) {
    rationale += ` Elevated WBC (${latestLabs.wbc} × 10⁹/L) may indicate infection or inflammation.`
    if (status === 'strong' || status === 'ok') status = 'borderline'
  }

  // Low WBC (immunosuppression)
  if (latestLabs?.wbc && latestLabs.wbc < 4) {
    rationale += ` Low WBC (${latestLabs.wbc} × 10⁹/L) may indicate immunosuppression.`
    if (status === 'strong' || status === 'ok') status = 'borderline'
  }

  // High RDW (red cell variation - early nutritional deficiency)
  if (latestLabs?.rdw && latestLabs.rdw > 14.5) {
    rationale += ` Elevated RDW (${latestLabs.rdw}%) indicates red cell size variation, suggesting nutritional deficiency.`
    if (status === 'strong' || status === 'ok') status = 'borderline'
  }

  return {
    domain: "hematology",
    score: Math.round(avgScore),
    status,
    rationale
  }
}

/**
 * Calculate advanced lipids domain score (ApoB, Lp(a), LDL-P)
 */
function calculateAdvancedLipidsScore(labHistory: LabSnapshot[], trends: MarkerTrend[]): DomainScore | null {
  // Advanced lipid markers: apob, lp_a, ldl_p
  const advLipidMarkers = ['apob', 'lp_a', 'ldl_p']
  
  const latestLabs = labHistory[labHistory.length - 1]?.labs
  const availableMarkers = advLipidMarkers.filter(m => latestLabs?.[m as keyof typeof latestLabs] !== undefined)
  
  if (availableMarkers.length === 0) return null

  let totalScore = 0
  let count = 0
  let rationale = `Based on ${availableMarkers.length} advanced lipid marker${availableMarkers.length > 1 ? 's' : ''}.`

  // Score each available marker
  availableMarkers.forEach(marker => {
    const score = scoreMarker(getLatestMarkerValue(labHistory, marker), marker)
    if (score !== null) {
      totalScore += score
      count++
    }
  })

  const avgScore = count > 0 ? totalScore / count : 75

  // Determine status
  let status: 'strong' | 'ok' | 'borderline' | 'concerning' = 'strong'
  if (avgScore < 45) status = 'concerning'
  else if (avgScore < 60) status = 'borderline'
  else if (avgScore < 75) status = 'ok'

  // ApoB interpretation (most important advanced lipid)
  if (latestLabs?.apob) {
    if (latestLabs.apob > 130) {
      rationale += ` Very high ApoB (${latestLabs.apob} mg/dL) indicates substantially elevated atherosclerosis risk.`
      status = 'concerning'
    } else if (latestLabs.apob > 110) {
      rationale += ` Elevated ApoB (${latestLabs.apob} mg/dL) suggests high atherogenic particle burden.`
      if (status === 'strong' || status === 'ok') status = 'borderline'
    } else if (latestLabs.apob < 80) {
      rationale += ` Optimal ApoB (${latestLabs.apob} mg/dL) - minimal atherosclerosis risk.`
    }
  }

  // Lp(a) interpretation (genetic risk factor)
  if (latestLabs?.lp_a) {
    if (latestLabs.lp_a > 75) {
      rationale += ` Very high Lp(a) (${latestLabs.lp_a} mg/dL) confers 2-3x genetic CV risk (not diet-modifiable).`
      status = 'concerning'
    } else if (latestLabs.lp_a > 50) {
      rationale += ` Elevated Lp(a) (${latestLabs.lp_a} mg/dL) indicates genetic CV risk (~2x normal).`
      if (status === 'strong' || status === 'ok') status = 'borderline'
    } else if (latestLabs.lp_a < 30) {
      rationale += ` Optimal Lp(a) (${latestLabs.lp_a} mg/dL) - low genetic risk.`
    }
  }

  // LDL-P interpretation
  if (latestLabs?.ldl_p) {
    if (latestLabs.ldl_p > 1600) {
      rationale += ` Elevated LDL particle count (${latestLabs.ldl_p} nmol/L) indicates high atherogenic burden.`
      if (status === 'strong' || status === 'ok') status = 'borderline'
    } else if (latestLabs.ldl_p < 1000) {
      rationale += ` Optimal LDL particle count (${latestLabs.ldl_p} nmol/L).`
    }
  }

  return {
    domain: "advanced_lipids",
    score: Math.round(avgScore),
    status,
    rationale
  }
}

/**
 * Calculate electrolytes domain score
 */
function calculateElectrolytesScore(labHistory: LabSnapshot[], trends: MarkerTrend[]): DomainScore | null {
  const electrolyteMarkers = ['sodium', 'potassium', 'chloride', 'co2']
  const latestLabs = labHistory[labHistory.length - 1]?.labs
  const availableMarkers = electrolyteMarkers.filter(m => latestLabs?.[m as keyof typeof latestLabs] !== undefined)
  
  if (availableMarkers.length === 0) return null

  let totalScore = 0
  let count = 0

  availableMarkers.forEach(marker => {
    const score = scoreMarker(getLatestMarkerValue(labHistory, marker), marker)
    if (score !== null) {
      totalScore += score
      count++
    }
  })

  const avgScore = count > 0 ? totalScore / count : 75
  let status: 'strong' | 'ok' | 'borderline' | 'concerning' = 'strong'
  if (avgScore < 45) status = 'concerning'
  else if (avgScore < 60) status = 'borderline'
  else if (avgScore < 75) status = 'ok'

  let rationale = `Based on ${availableMarkers.length} electrolyte marker${availableMarkers.length > 1 ? 's' : ''}.`

  // Critical electrolyte checks
  if (latestLabs?.potassium && (latestLabs.potassium < 3.0 || latestLabs.potassium > 5.5)) {
    rationale += ` Critical potassium level requires immediate attention.`
    status = 'concerning'
  }
  if (latestLabs?.sodium && (latestLabs.sodium < 130 || latestLabs.sodium > 150)) {
    rationale += ` Critical sodium level requires immediate attention.`
    status = 'concerning'
  }

  return {
    domain: "electrolytes",
    score: Math.round(avgScore),
    status,
    rationale
  }
}

/**
 * Calculate bone health domain score (Calcium, Phosphorus, PTH, Vitamin D, ALP)
 */
function calculateBoneHealthScore(labHistory: LabSnapshot[], trends: MarkerTrend[]): DomainScore | null {
  const boneMarkers = ['calcium', 'phosphorus', 'pth', 'vitamin_d', 'alp']
  const latestLabs = labHistory[labHistory.length - 1]?.labs
  const availableMarkers = boneMarkers.filter(m => latestLabs?.[m as keyof typeof latestLabs] !== undefined)
  
  if (availableMarkers.length === 0) return null

  let totalScore = 0
  let count = 0

  availableMarkers.forEach(marker => {
    const score = scoreMarker(getLatestMarkerValue(labHistory, marker), marker)
    if (score !== null) {
      totalScore += score
      count++
    }
  })

  const avgScore = count > 0 ? totalScore / count : 75
  let status: 'strong' | 'ok' | 'borderline' | 'concerning' = 'strong'
  if (avgScore < 45) status = 'concerning'
  else if (avgScore < 60) status = 'borderline'
  else if (avgScore < 75) status = 'ok'

  let rationale = `Based on ${availableMarkers.length} bone health marker${availableMarkers.length > 1 ? 's' : ''}.`

  // Calcium interpretation
  if (latestLabs?.calcium) {
    if (latestLabs.calcium < 8.5) {
      rationale += ` Low calcium (${latestLabs.calcium} mg/dL) may indicate vitamin D deficiency or PTH abnormality.`
      if (status === 'strong' || status === 'ok') status = 'borderline'
    } else if (latestLabs.calcium > 10.5) {
      rationale += ` Elevated calcium (${latestLabs.calcium} mg/dL) requires evaluation for hyperparathyroidism.`
      if (status === 'strong' || status === 'ok') status = 'borderline'
    }
  }

  // PTH interpretation (parathyroid hormone)
  if (latestLabs?.pth) {
    if (latestLabs.pth > 65) {
      rationale += ` Elevated PTH (${latestLabs.pth} pg/mL) may indicate vitamin D deficiency or hyperparathyroidism.`
      if (status === 'strong' || status === 'ok') status = 'borderline'
    } else if (latestLabs.pth < 15) {
      rationale += ` Low PTH (${latestLabs.pth} pg/mL) may indicate hypoparathyroidism.`
      if (status === 'strong' || status === 'ok') status = 'borderline'
    }
  }

  // Vitamin D + calcium connection
  if (latestLabs?.vitamin_d && latestLabs?.calcium) {
    if (latestLabs.vitamin_d < 30 && latestLabs.calcium < 9.0) {
      rationale += ` Low vitamin D and calcium together increase osteoporosis risk.`
      status = 'concerning'
    }
  }

  // Phosphorus interpretation
  if (latestLabs?.phosphorus) {
    if (latestLabs.phosphorus < 2.5) {
      rationale += ` Low phosphorus (${latestLabs.phosphorus} mg/dL) may indicate malnutrition or vitamin D deficiency.`
    } else if (latestLabs.phosphorus > 4.5) {
      rationale += ` High phosphorus (${latestLabs.phosphorus} mg/dL) may indicate kidney dysfunction.`
    }
  }

  return {
    domain: "bone_health",
    score: Math.round(avgScore),
    status,
    rationale
  }
}

/**
 * Calculate iron panel domain score (Serum Iron, TIBC, Transferrin Saturation, Ferritin)
 */
function calculateIronPanelScore(labHistory: LabSnapshot[], trends: MarkerTrend[], userProfile?: UserProfile): DomainScore | null {
  const ironMarkers = ['serum_iron', 'tibc', 'transferrin_saturation', 'ferritin']
  const latestLabs = labHistory[labHistory.length - 1]?.labs
  const availableMarkers = ironMarkers.filter(m => latestLabs?.[m as keyof typeof latestLabs] !== undefined)
  
  if (availableMarkers.length === 0) return null

  let totalScore = 0
  let count = 0

  // Calculate transferrin saturation if not provided but serum_iron and tibc are available
  let transferrinSat = latestLabs?.transferrin_saturation
  if (!transferrinSat && latestLabs?.serum_iron && latestLabs?.tibc) {
    transferrinSat = (latestLabs.serum_iron / latestLabs.tibc) * 100
  }

  availableMarkers.forEach(marker => {
    const value = marker === 'transferrin_saturation' && !latestLabs?.[marker] 
      ? transferrinSat 
      : getLatestMarkerValue(labHistory, marker)
    
    if (value !== null) {
      const score = scoreMarker(value, marker)
      totalScore += score
      count++
    }
  })

  const avgScore = count > 0 ? totalScore / count : 75
  let status: 'strong' | 'ok' | 'borderline' | 'concerning' = 'strong'
  if (avgScore < 45) status = 'concerning'
  else if (avgScore < 60) status = 'borderline'
  else if (avgScore < 75) status = 'ok'

  let rationale = `Based on ${count} iron marker${count > 1 ? 's' : ''}.`

  // Iron deficiency interpretation
  if (latestLabs?.ferritin && latestLabs.ferritin < 30) {
    rationale += ` Low ferritin (${latestLabs.ferritin} ng/mL) indicates depleted iron stores.`
    if (status === 'strong' || status === 'ok') status = 'borderline'
  }

  // Transferrin saturation interpretation (key iron status marker)
  if (transferrinSat) {
    if (transferrinSat < 20) {
      rationale += ` Low transferrin saturation (${transferrinSat.toFixed(1)}%) indicates iron deficiency anemia.`
      status = 'concerning'
    } else if (transferrinSat > 45) {
      rationale += ` High transferrin saturation (${transferrinSat.toFixed(1)}%) may indicate iron overload (hemochromatosis).`
      if (status === 'strong' || status === 'ok') status = 'borderline'
    } else if (transferrinSat >= 25 && transferrinSat <= 35) {
      rationale += ` Optimal transferrin saturation (${transferrinSat.toFixed(1)}%).`
    }
  }

  // TIBC interpretation (inversely related to iron status)
  if (latestLabs?.tibc) {
    if (latestLabs.tibc > 400) {
      rationale += ` Elevated TIBC (${latestLabs.tibc} μg/dL) suggests iron deficiency.`
    } else if (latestLabs.tibc < 250) {
      rationale += ` Low TIBC (${latestLabs.tibc} μg/dL) may indicate inflammation or iron overload.`
    }
  }

  // Serum iron interpretation
  if (latestLabs?.serum_iron) {
    if (latestLabs.serum_iron < 60) {
      rationale += ` Low serum iron (${latestLabs.serum_iron} μg/dL) indicates iron deficiency.`
    }
  }

  // Sex-specific iron considerations
  const sex = userProfile?.sex
  if (sex === 'female' && latestLabs?.ferritin && latestLabs.ferritin < 50) {
    rationale += ` Women often need higher ferritin for optimal energy and thyroid function.`
  }

  return {
    domain: "iron_panel",
    score: Math.round(avgScore),
    status,
    rationale
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
    calculateNutrientScore(labHistory, trends),
    calculateThyroidScore(labHistory, trends),
    calculateHormoneScore(labHistory, trends, userProfile),
    calculateHematologyScore(labHistory, trends, userProfile),
    calculateAdvancedLipidsScore(labHistory, trends),
    calculateElectrolytesScore(labHistory, trends),
    calculateBoneHealthScore(labHistory, trends),
    calculateIronPanelScore(labHistory, trends, userProfile)
  ]

  return domains.filter(d => d !== null) as DomainScore[]
}
