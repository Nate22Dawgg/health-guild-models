/**
 * Kidney function calculators
 * eGFR (CKD-EPI 2021, race-free) and CKD staging
 */

export function egfrCKDEPI2021(creatinine: number, age: number, sex: string): number {
  if (creatinine <= 0) {
    throw new Error('Creatinine must be positive')
  }
  if (age < 18) {
    throw new Error('CKD-EPI equation is for adults (age ≥ 18)')
  }

  let kappa: number, alpha: number, femaleFactor: number

  if (sex.toLowerCase() === 'female') {
    kappa = 0.7
    alpha = -0.241
    femaleFactor = 1.012
  } else {
    kappa = 0.9
    alpha = -0.302
    femaleFactor = 1.0
  }

  const minRatio = Math.min(creatinine / kappa, 1.0)
  const maxRatio = Math.max(creatinine / kappa, 1.0)

  const egfr = 142 * Math.pow(minRatio, alpha) * Math.pow(maxRatio, -1.200) * Math.pow(0.9938, age) * femaleFactor

  return Number(egfr.toFixed(1))
}

export function ckdStage(egfr: number): string {
  if (egfr >= 90) {
    return 'G1'
  } else if (egfr >= 60) {
    return 'G2'
  } else if (egfr >= 45) {
    return 'G3a'
  } else if (egfr >= 30) {
    return 'G3b'
  } else if (egfr >= 15) {
    return 'G4'
  } else {
    return 'G5'
  }
}

interface CKDStageInfo {
  stage: string
  description: string
  egfrRange: string
}

export function ckdStageDescription(stage: string): CKDStageInfo {
  const descriptions: Record<string, CKDStageInfo> = {
    G1: {
      stage: 'G1',
      description: 'Normal or high kidney function (with kidney damage)',
      egfrRange: '≥90 mL/min/1.73m²'
    },
    G2: {
      stage: 'G2',
      description: 'Mildly decreased kidney function',
      egfrRange: '60-89 mL/min/1.73m²'
    },
    G3a: {
      stage: 'G3a',
      description: 'Mild to moderately decreased kidney function',
      egfrRange: '45-59 mL/min/1.73m²'
    },
    G3b: {
      stage: 'G3b',
      description: 'Moderately to severely decreased kidney function',
      egfrRange: '30-44 mL/min/1.73m²'
    },
    G4: {
      stage: 'G4',
      description: 'Severely decreased kidney function',
      egfrRange: '15-29 mL/min/1.73m²'
    },
    G5: {
      stage: 'G5',
      description: 'Kidney failure (dialysis or transplant needed)',
      egfrRange: '<15 mL/min/1.73m²'
    }
  }

  return descriptions[stage] || { stage, description: 'Unknown', egfrRange: 'N/A' }
}
