/**
 * Derived Ratio Calculators
 * Clinical ratios calculated from existing lab markers
 * Evidence-based diagnostic and risk assessment tools
 */

export interface DerivedRatioResult {
  ratio: number
  category: string
  interpretation: string
  evidence_tier: string
}

/**
 * BUN/Creatinine Ratio
 * Helps differentiate prerenal, renal, and postrenal azotemia
 * Reference: Normal = 10-20, Prerenal = >20, Renal = <10
 */
export function bunCreatinineRatio(
  bunMgDl: number, 
  creatinineMgDl: number
): DerivedRatioResult {
  if (bunMgDl <= 0 || creatinineMgDl <= 0) {
    throw new Error('BUN and creatinine must be positive values')
  }

  const ratio = bunMgDl / creatinineMgDl

  let category: string
  let interpretation: string

  if (ratio < 10) {
    category = 'low'
    interpretation = 'May suggest intrinsic renal disease, low protein intake, or liver disease'
  } else if (ratio <= 20) {
    category = 'normal'
    interpretation = 'Normal kidney function and hydration status'
  } else if (ratio <= 30) {
    category = 'elevated'
    interpretation = 'May indicate prerenal azotemia (dehydration, heart failure) or high protein intake'
  } else {
    category = 'high'
    interpretation = 'Suggests significant prerenal azotemia or upper GI bleed'
  }

  return {
    ratio: Math.round(ratio * 10) / 10,
    category,
    interpretation,
    evidence_tier: 'A' // Well-established clinical tool
  }
}

/**
 * AST/ALT Ratio (De Ritis Ratio)
 * Helps distinguish types of liver disease
 * Reference: Normal = 0.8-1.0, >2.0 suggests alcoholic liver disease
 */
export function astAltRatio(
  astUL: number,
  altUL: number
): DerivedRatioResult {
  if (astUL <= 0 || altUL <= 0) {
    throw new Error('AST and ALT must be positive values')
  }

  const ratio = astUL / altUL

  let category: string
  let interpretation: string

  if (ratio < 0.8) {
    category = 'low'
    interpretation = 'Suggests non-alcoholic fatty liver disease (NAFLD) or chronic viral hepatitis'
  } else if (ratio <= 1.0) {
    category = 'normal'
    interpretation = 'Normal liver enzyme ratio'
  } else if (ratio <= 2.0) {
    category = 'elevated'
    interpretation = 'May indicate chronic liver disease or cirrhosis'
  } else {
    category = 'high'
    interpretation = 'Strongly suggests alcoholic liver disease or severe cirrhosis'
  }

  return {
    ratio: Math.round(ratio * 100) / 100,
    category,
    interpretation,
    evidence_tier: 'A' // Well-established diagnostic tool
  }
}

/**
 * TG/HDL Ratio
 * Strong predictor of insulin resistance and cardiovascular risk
 * Reference: Optimal <2, Concerning >3 (using mg/dL units)
 */
export function tgHdlRatio(
  triglyceridesMgDl: number,
  hdlMgDl: number
): DerivedRatioResult {
  if (triglyceridesMgDl <= 0 || hdlMgDl <= 0) {
    throw new Error('Triglycerides and HDL must be positive values')
  }

  const ratio = triglyceridesMgDl / hdlMgDl

  let category: string
  let interpretation: string

  if (ratio < 2.0) {
    category = 'optimal'
    interpretation = 'Excellent - Low risk for insulin resistance and cardiovascular disease'
  } else if (ratio <= 3.0) {
    category = 'borderline'
    interpretation = 'Borderline - May indicate early insulin resistance'
  } else if (ratio <= 5.0) {
    category = 'elevated'
    interpretation = 'Elevated - Strong indicator of insulin resistance and increased CV risk'
  } else {
    category = 'high'
    interpretation = 'Very high - Significant insulin resistance and markedly increased CV risk'
  }

  return {
    ratio: Math.round(ratio * 100) / 100,
    category,
    interpretation,
    evidence_tier: 'B' // Strong clinical evidence
  }
}

/**
 * Non-HDL Cholesterol
 * All atherogenic lipoproteins (LDL + VLDL + IDL + Lp(a))
 * Better predictor than LDL alone, especially for high triglycerides
 * Reference: Optimal <130, Borderline 130-159, High ≥160 mg/dL
 */
export function nonHdlCholesterol(
  totalCholMgDl: number,
  hdlMgDl: number
): DerivedRatioResult {
  if (totalCholMgDl <= 0 || hdlMgDl <= 0) {
    throw new Error('Total cholesterol and HDL must be positive values')
  }

  const nonHdl = totalCholMgDl - hdlMgDl

  let category: string
  let interpretation: string

  if (nonHdl < 130) {
    category = 'optimal'
    interpretation = 'Optimal - Low cardiovascular risk from atherogenic lipoproteins'
  } else if (nonHdl < 160) {
    category = 'borderline'
    interpretation = 'Borderline high - Moderate cardiovascular risk'
  } else if (nonHdl < 190) {
    category = 'high'
    interpretation = 'High - Increased cardiovascular risk, lifestyle changes recommended'
  } else {
    category = 'very_high'
    interpretation = 'Very high - Significantly increased CV risk, consider lipid-lowering therapy'
  }

  return {
    ratio: Math.round(nonHdl),
    category,
    interpretation,
    evidence_tier: 'A' // ACC/AHA guidelines recommend non-HDL as secondary target
  }
}

/**
 * Total Cholesterol/HDL Ratio
 * Classic cardiovascular risk indicator
 * Reference: Optimal <3.5, Concerning >5.0
 */
export function totalCholHdlRatio(
  totalCholMgDl: number,
  hdlMgDl: number
): DerivedRatioResult {
  if (totalCholMgDl <= 0 || hdlMgDl <= 0) {
    throw new Error('Total cholesterol and HDL must be positive values')
  }

  const ratio = totalCholMgDl / hdlMgDl

  let category: string
  let interpretation: string

  if (ratio < 3.5) {
    category = 'optimal'
    interpretation = 'Optimal - Low cardiovascular risk'
  } else if (ratio <= 5.0) {
    category = 'borderline'
    interpretation = 'Borderline - Moderate cardiovascular risk'
  } else if (ratio <= 6.0) {
    category = 'elevated'
    interpretation = 'Elevated - Increased cardiovascular risk'
  } else {
    category = 'high'
    interpretation = 'High - Significantly increased cardiovascular risk'
  }

  return {
    ratio: Math.round(ratio * 100) / 100,
    category,
    interpretation,
    evidence_tier: 'A' // Well-established risk marker
  }
}
