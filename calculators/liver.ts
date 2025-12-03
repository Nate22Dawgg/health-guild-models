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
