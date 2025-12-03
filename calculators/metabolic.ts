/**
 * Metabolic health calculators
 * HOMA-IR and related insulin resistance measures
 */

export function homaIR(glucoseMgDl: number, insulinUUMl: number): number {
  if (glucoseMgDl <= 0 || insulinUUMl <= 0) {
    throw new Error('Glucose and insulin must be positive values')
  }
  return (glucoseMgDl * insulinUUMl) / 405.0
}

export function homaIRCategory(score: number): string {
  if (score < 1.0) {
    return 'insulin_sensitive'
  } else if (score <= 2.0) {
    return 'borderline'
  } else {
    return 'insulin_resistant'
  }
}

export function quicki(glucoseMgDl: number, insulinUUMl: number): number {
  if (glucoseMgDl <= 0 || insulinUUMl <= 0) {
    throw new Error('Glucose and insulin must be positive')
  }
  return 1 / (Math.log10(insulinUUMl) + Math.log10(glucoseMgDl))
}

export function homaBeta(glucoseMgDl: number, insulinUUMl: number): number {
  if (glucoseMgDl <= 63) {
    throw new Error('Glucose must be > 63 mg/dL for HOMA-β calculation')
  }
  return (360 * insulinUUMl) / (glucoseMgDl - 63)
}
