/**
 * Health Guild Risk Calculators
 * Main entry point for all calculator functions
 */

import { pooledCohortASCVD } from './cardiovascular'
import { fib4, fib4Category, nafldFibrosisScorenafld } from './liver'
import { egfrCKDEPI2021, ckdStage, ckdStageDescription } from './kidney'
import { homaIR, homaIRCategory, quicki } from './metabolic'

export interface UserProfile {
  age: number
  sex: string
  race?: string
  smoker?: boolean
  diabetic?: boolean
  onBPMeds?: boolean
  bmi?: number
}

export interface Labs {
  totalChol: number
  hdl: number
  sbp: number
  ast: number
  alt: number
  platelets: number
  creatinine: number
  fastingGlucose: number
  fastingInsulin?: number
  albumin?: number
}

export interface RiskScoreResults {
  ascvd10y?: any
  fib4?: any
  egfr?: any
  homaIr?: any
  nafld?: any
}

export interface ModelExecutionMetadata {
  models_ran: Array<{
    name: string
    version: string
    status: 'ok' | 'warning'
    inputs_used: string[]
    evidence_tier: 'well_supported' | 'emerging' | 'experimental'
    result_summary: string
    raw_result: any
  }>
  models_skipped: Array<{
    name: string
    reason: 'missing_inputs' | 'out_of_range' | 'not_applicable'
    missing_inputs?: string[]
    note?: string
  }>
}

export function computeRiskScores(userProfile: UserProfile, labs: Labs): RiskScoreResults {
  // This function now only returns raw results
  // Use computeRiskScoresWithMetadata for full transparency
  const results: RiskScoreResults = {}

  // ASCVD 10-year risk
  try {
    results.ascvd10y = pooledCohortASCVD({
      age: userProfile.age,
      sex: userProfile.sex,
      race: userProfile.race || 'white',
      totalChol: labs.totalChol,
      hdl: labs.hdl,
      systolicBP: labs.sbp,
      onBPMeds: userProfile.onBPMeds || false,
      smoker: userProfile.smoker || false,
      diabetic: userProfile.diabetic || false
    })
  } catch (e: any) {
    results.ascvd10y = { error: e.message }
  }

  // FIB-4 liver fibrosis
  try {
    const fib4Score = fib4(userProfile.age, labs.ast, labs.alt, labs.platelets)
    results.fib4 = {
      score: Number(fib4Score.toFixed(2)),
      category: fib4Category(fib4Score)
    }
  } catch (e: any) {
    results.fib4 = { error: e.message }
  }

  // eGFR and CKD staging
  try {
    const egfrValue = egfrCKDEPI2021(labs.creatinine, userProfile.age, userProfile.sex)
    const stage = ckdStage(egfrValue)
    results.egfr = {
      score: egfrValue,
      stage: stage,
      stageInfo: ckdStageDescription(stage)
    }
  } catch (e: any) {
    results.egfr = { error: e.message }
  }

  // HOMA-IR (if fasting insulin available)
  if (labs.fastingInsulin !== undefined) {
    try {
      const homaScore = homaIR(labs.fastingGlucose, labs.fastingInsulin)
      const quickiScore = quicki(labs.fastingGlucose, labs.fastingInsulin)
      results.homaIr = {
        score: Number(homaScore.toFixed(2)),
        category: homaIRCategory(homaScore),
        quicki: Number(quickiScore.toFixed(3))
      }
    } catch (e: any) {
      results.homaIr = { error: e.message }
    }
  }

  // NAFLD Fibrosis Score (if albumin and BMI available)
  if (labs.albumin !== undefined && userProfile.bmi !== undefined) {
    try {
      results.nafld = nafldFibrosisScorenafld({
        age: userProfile.age,
        bmi: userProfile.bmi,
        impairedFastingGlucoseOrDiabetes: userProfile.diabetic || false,
        ast: labs.ast,
        alt: labs.alt,
        platelets: labs.platelets,
        albumin: labs.albumin
      })
    } catch (e: any) {
      results.nafld = { error: e.message }
    }
  }

  return results
}

/**
 * Compute risk scores WITH transparency metadata (models_ran, models_skipped)
 */
export function computeRiskScoresWithMetadata(
  userProfile: UserProfile,
  labs: Labs
): { results: RiskScoreResults; metadata: ModelExecutionMetadata } {
  const results: RiskScoreResults = {}
  const models_ran: ModelExecutionMetadata['models_ran'] = []
  const models_skipped: ModelExecutionMetadata['models_skipped'] = []

  // ASCVD 10-year risk
  try {
    if (userProfile.age && userProfile.age >= 20 && userProfile.age <= 79 &&
        labs.totalChol && labs.hdl && labs.sbp) {
      results.ascvd10y = pooledCohortASCVD({
        age: userProfile.age,
        sex: userProfile.sex,
        race: userProfile.race || 'white',
        totalChol: labs.totalChol,
        hdl: labs.hdl,
        systolicBP: labs.sbp,
        onBPMeds: userProfile.onBPMeds || false,
        smoker: userProfile.smoker || false,
        diabetic: userProfile.diabetic || false
      })
      models_ran.push({
        name: 'ASCVD_10YR',
        version: '2013 ACC/AHA Pooled Cohort Equations',
        status: 'ok',
        inputs_used: ['age', 'sex', 'race', 'total_chol', 'hdl', 'systolic_bp', 'smoker', 'diabetic', 'on_bp_meds'],
        evidence_tier: 'well_supported',
        result_summary: `${results.ascvd10y.percentage?.toFixed(2)}% 10-year ASCVD risk (${results.ascvd10y.category})`,
        raw_result: results.ascvd10y
      })
    } else {
      const missing: string[] = []
      if (!userProfile.age || userProfile.age < 20 || userProfile.age > 79) missing.push('age (20-79)')
      if (!labs.totalChol) missing.push('total_chol')
      if (!labs.hdl) missing.push('hdl')
      if (!labs.sbp) missing.push('systolic_bp')
      models_skipped.push({
        name: 'ASCVD_10YR',
        reason: missing.length > 0 ? 'missing_inputs' : 'out_of_range',
        missing_inputs: missing,
        note: missing.length > 0 ? undefined : 'Age must be 20-79 years'
      })
    }
  } catch (e: any) {
    results.ascvd10y = { error: e.message }
    models_ran.push({
      name: 'ASCVD_10YR',
      version: '2013 ACC/AHA Pooled Cohort Equations',
      status: 'warning',
      inputs_used: ['age', 'sex', 'race', 'total_chol', 'hdl', 'systolic_bp'],
      evidence_tier: 'well_supported',
      result_summary: `Error: ${e.message}`,
      raw_result: results.ascvd10y
    })
  }

  // FIB-4 liver fibrosis
  try {
    if (labs.ast && labs.alt && labs.platelets) {
      const fib4Score = fib4(userProfile.age, labs.ast, labs.alt, labs.platelets)
      results.fib4 = {
        score: Number(fib4Score.toFixed(2)),
        category: fib4Category(fib4Score)
      }
      models_ran.push({
        name: 'FIB4',
        version: 'FIB-4 Index',
        status: 'ok',
        inputs_used: ['age', 'ast', 'alt', 'platelets'],
        evidence_tier: 'well_supported',
        result_summary: `FIB-4 score ${results.fib4.score} (${results.fib4.category})`,
        raw_result: results.fib4
      })
    } else {
      const missing: string[] = []
      if (!labs.ast) missing.push('ast')
      if (!labs.alt) missing.push('alt')
      if (!labs.platelets) missing.push('platelets')
      models_skipped.push({
        name: 'FIB4',
        reason: 'missing_inputs',
        missing_inputs: missing
      })
    }
  } catch (e: any) {
    results.fib4 = { error: e.message }
    models_ran.push({
      name: 'FIB4',
      version: 'FIB-4 Index',
      status: 'warning',
      inputs_used: ['age', 'ast', 'alt', 'platelets'],
      evidence_tier: 'well_supported',
      result_summary: `Error: ${e.message}`,
      raw_result: results.fib4
    })
  }

  // eGFR and CKD staging
  try {
    if (labs.creatinine) {
      const egfrValue = egfrCKDEPI2021(labs.creatinine, userProfile.age, userProfile.sex)
      const stage = ckdStage(egfrValue)
      results.egfr = {
        score: egfrValue,
        stage: stage,
        stageInfo: ckdStageDescription(stage)
      }
      models_ran.push({
        name: 'EGFR_CKD_EPI_2021',
        version: 'CKD-EPI 2021 (race-free)',
        status: 'ok',
        inputs_used: ['age', 'sex', 'creatinine'],
        evidence_tier: 'well_supported',
        result_summary: `eGFR ${egfrValue.toFixed(1)} ml/min/1.73m² (CKD Stage ${stage})`,
        raw_result: results.egfr
      })
    } else {
      models_skipped.push({
        name: 'EGFR_CKD_EPI_2021',
        reason: 'missing_inputs',
        missing_inputs: ['creatinine']
      })
    }
  } catch (e: any) {
    results.egfr = { error: e.message }
    models_ran.push({
      name: 'EGFR_CKD_EPI_2021',
      version: 'CKD-EPI 2021 (race-free)',
      status: 'warning',
      inputs_used: ['age', 'sex', 'creatinine'],
      evidence_tier: 'well_supported',
      result_summary: `Error: ${e.message}`,
      raw_result: results.egfr
    })
  }

  // HOMA-IR (if fasting insulin available)
  if (labs.fastingInsulin !== undefined && labs.fastingGlucose) {
    try {
      const homaScore = homaIR(labs.fastingGlucose, labs.fastingInsulin)
      const quickiScore = quicki(labs.fastingGlucose, labs.fastingInsulin)
      results.homaIr = {
        score: Number(homaScore.toFixed(2)),
        category: homaIRCategory(homaScore),
        quicki: Number(quickiScore.toFixed(3))
      }
      models_ran.push({
        name: 'HOMA_IR',
        version: 'Homeostatic Model Assessment',
        status: 'ok',
        inputs_used: ['fasting_glucose', 'fasting_insulin'],
        evidence_tier: 'emerging',
        result_summary: `HOMA-IR ${results.homaIr.score} (${results.homaIr.category})`,
        raw_result: results.homaIr
      })
    } catch (e: any) {
      results.homaIr = { error: e.message }
      models_ran.push({
        name: 'HOMA_IR',
        version: 'Homeostatic Model Assessment',
        status: 'warning',
        inputs_used: ['fasting_glucose', 'fasting_insulin'],
        evidence_tier: 'emerging',
        result_summary: `Error: ${e.message}`,
        raw_result: results.homaIr
      })
    }
  } else {
    const missing: string[] = []
    if (!labs.fastingGlucose) missing.push('fasting_glucose')
    if (labs.fastingInsulin === undefined) missing.push('fasting_insulin')
    models_skipped.push({
      name: 'HOMA_IR',
      reason: 'missing_inputs',
      missing_inputs: missing,
      note: 'Fasting insulin is optional but required for HOMA-IR calculation'
    })
  }

  // NAFLD Fibrosis Score (if albumin and BMI available)
  if (labs.albumin !== undefined && userProfile.bmi !== undefined && labs.ast && labs.alt && labs.platelets) {
    try {
      results.nafld = nafldFibrosisScorenafld({
        age: userProfile.age,
        bmi: userProfile.bmi,
        impairedFastingGlucoseOrDiabetes: userProfile.diabetic || false,
        ast: labs.ast,
        alt: labs.alt,
        platelets: labs.platelets,
        albumin: labs.albumin
      })
      models_ran.push({
        name: 'NAFLD',
        version: 'NAFLD Fibrosis Score',
        status: 'ok',
        inputs_used: ['age', 'bmi', 'diabetic', 'ast', 'alt', 'platelets', 'albumin'],
        evidence_tier: 'well_supported',
        result_summary: `NAFLD score ${results.nafld.score?.toFixed(2)} (${results.nafld.category})`,
        raw_result: results.nafld
      })
    } catch (e: any) {
      results.nafld = { error: e.message }
      models_ran.push({
        name: 'NAFLD',
        version: 'NAFLD Fibrosis Score',
        status: 'warning',
        inputs_used: ['age', 'bmi', 'diabetic', 'ast', 'alt', 'platelets', 'albumin'],
        evidence_tier: 'well_supported',
        result_summary: `Error: ${e.message}`,
        raw_result: results.nafld
      })
    }
  } else {
    const missing: string[] = []
    if (labs.albumin === undefined) missing.push('albumin')
    if (userProfile.bmi === undefined) missing.push('bmi')
    if (!labs.ast) missing.push('ast')
    if (!labs.alt) missing.push('alt')
    if (!labs.platelets) missing.push('platelets')
    models_skipped.push({
      name: 'NAFLD',
      reason: 'missing_inputs',
      missing_inputs: missing,
      note: 'Albumin and BMI are optional but required for NAFLD score'
    })
  }

  return {
    results,
    metadata: {
      models_ran,
      models_skipped
    }
  }
}

// Export individual calculators
export {
  pooledCohortASCVD,
  fib4,
  fib4Category,
  nafldFibrosisScorenafld,
  egfrCKDEPI2021,
  ckdStage,
  ckdStageDescription,
  homaIR,
  homaIRCategory,
  quicki
}

// Export derived ratios
export {
  bunCreatinineRatio,
  astAltRatio,
  tgHdlRatio,
  nonHdlCholesterol,
  totalCholHdlRatio
} from './derived-ratios'

// Export thyroid calculators
export {
  assessThyroidFunction,
  calculateT3ReverseT3Ratio,
  calculateT3T4Ratio,
  assessHashimotosRisk
} from './thyroid'

// Export hormone calculators
export {
  assessHormonePanel,
  type HormoneInputs,
  type HormoneAssessment
} from './hormone'

// Export CBC calculators
export {
  assessCBC,
  type CBCInputs,
  type CBCAssessment
} from './cbc'

// Export advanced lipids calculators
export {
  assessAdvancedLipids,
  type AdvancedLipidsInputs,
  type AdvancedLipidsAssessment
} from './advanced-lipids'

// Export electrolytes calculators
export {
  assessElectrolytes,
  type ElectrolytesInputs,
  type ElectrolytesAssessment
} from './electrolytes'
