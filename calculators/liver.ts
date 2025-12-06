/**
 * Liver fibrosis calculators
 * FIB-4 and NAFLD Fibrosis Score
 */

export function fib4(age: number, ast: number, alt: number, platelets: number): number {
  if (platelets <= 0 || alt <= 0) {
    throw new Error('Platelets and ALT must be positive values')
  }
  return (age * ast) / (platelets * Math.sqrt(alt))
}

export function fib4Category(score: number): string {
  if (score < 1.3) {
    return 'low'
  } else if (score <= 2.67) {
    return 'indeterminate'
  } else {
    return 'high'
  }
}

interface NAFLDParams {
  age: number
  bmi: number
  impairedFastingGlucoseOrDiabetes: boolean
  ast: number
  alt: number
  platelets: number
  albumin: number
}

interface NAFLDResult {
  score: number
  category: string
}

export function nafldFibrosisScorenafld(params: NAFLDParams): NAFLDResult {
  const { age, bmi, impairedFastingGlucoseOrDiabetes, ast, alt, platelets, albumin } = params

  if (alt <= 0) {
    throw new Error('ALT must be positive')
  }

  const astAltRatio = ast / alt

  const score =
    -1.675 +
    0.037 * age +
    0.094 * bmi +
    1.13 * (impairedFastingGlucoseOrDiabetes ? 1 : 0) +
    0.99 * astAltRatio -
    0.013 * platelets -
    0.66 * albumin

  let category: string
  if (score < -1.455) {
    category = 'low'
  } else if (score <= 0.676) {
    category = 'indeterminate'
  } else {
    category = 'high'
  }

  return {
    score: Number(score.toFixed(3)),
    category
  }
}

/**
 * AST/ALT Ratio Calculator
 * Helps differentiate types of liver disease
 * Evidence: Tier B (widely used clinically)
 */
export interface ASTALTRatioResult {
  ratio: number
  interpretation: string
  category: 'normal' | 'non_alcoholic' | 'alcoholic' | 'cirrhosis'
  clinical_significance: string
}

export function calculateASTALTRatio(ast: number, alt: number): ASTALTRatioResult {
  if (ast <= 0 || alt <= 0) {
    throw new Error('AST and ALT must be positive values')
  }

  const ratio = ast / alt
  let interpretation: string
  let category: 'normal' | 'non_alcoholic' | 'alcoholic' | 'cirrhosis'
  let clinical_significance: string

  if (ratio < 1) {
    category = 'normal'
    interpretation = 'Normal ratio (ALT typically higher than AST)'
    clinical_significance = 'Typical pattern in healthy individuals or early non-alcoholic fatty liver disease (NAFLD).'
  } else if (ratio >= 1 && ratio < 2) {
    category = 'non_alcoholic'
    interpretation = 'Mild elevation, consistent with various liver conditions'
    clinical_significance = 'May indicate non-alcoholic liver disease, viral hepatitis, or early liver injury. Further evaluation recommended.'
  } else if (ratio >= 2) {
    category = 'alcoholic'
    interpretation = 'Elevated ratio suggests alcoholic liver disease or cirrhosis'
    clinical_significance = 'AST/ALT ratio >2 is highly suggestive of alcoholic liver disease or advanced cirrhosis. AST elevation may also reflect cardiac or muscle damage.'
  } else {
    category = 'normal'
    interpretation = 'Within normal range'
    clinical_significance = 'Liver enzymes show typical proportions.'
  }

  return {
    ratio: Number(ratio.toFixed(2)),
    interpretation,
    category,
    clinical_significance
  }
}
