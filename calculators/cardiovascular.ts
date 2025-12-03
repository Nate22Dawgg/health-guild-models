/**
 * Cardiovascular risk calculators
 * Pooled Cohort Equations for ASCVD 10-year risk
 */

interface ASCVDParams {
  age: number
  sex: string
  race: string
  totalChol: number
  hdl: number
  systolicBP: number
  onBPMeds: boolean
  smoker: boolean
  diabetic: boolean
}

interface ASCVDResult {
  score: number
  category: string
  percentage: number
}

export function pooledCohortASCVD(params: ASCVDParams): ASCVDResult {
  const { age, sex, race, totalChol, hdl, systolicBP, onBPMeds, smoker, diabetic } = params

  // Validate age range
  if (age < 20 || age > 79) {
    throw new Error('Age must be between 20 and 79 years')
  }

  let lnAge: number, lnAgeSq: number, lnTotalChol: number, lnAgeTotalChol: number
  let lnHDL: number, lnAgeHDL: number, lnTreatedSBP: number, lnUntreatedSBP: number
  let lnAgeTreatedSBP: number, lnAgeUntreatedSBP: number, smokerCoef: number
  let lnAgeSmoker: number, diabeticCoef: number, meanCoef: number, baselineSurvival: number

  if (sex.toLowerCase() === 'female') {
    if (race.toLowerCase() === 'black' || race.toLowerCase() === 'african american') {
      // Black female coefficients
      lnAge = 17.1141
      lnAgeSq = 0
      lnTotalChol = 0.9396
      lnAgeTotalChol = 0
      lnHDL = -18.9196
      lnAgeHDL = 4.4748
      lnTreatedSBP = onBPMeds ? 29.2907 : 0
      lnUntreatedSBP = !onBPMeds ? 27.8197 : 0
      lnAgeTreatedSBP = onBPMeds ? -6.4321 : 0
      lnAgeUntreatedSBP = !onBPMeds ? -6.0873 : 0
      smokerCoef = 0.6908
      lnAgeSmoker = 0
      diabeticCoef = 0.8738
      meanCoef = 86.6081
      baselineSurvival = 0.9533
    } else {
      // White/other female coefficients
      lnAge = -29.7990
      lnAgeSq = 4.8842
      lnTotalChol = 13.5400
      lnAgeTotalChol = -3.1140
      lnHDL = -13.5780
      lnAgeHDL = 3.1490
      lnTreatedSBP = onBPMeds ? 2.0190 : 0
      lnUntreatedSBP = !onBPMeds ? 1.9570 : 0
      lnAgeTreatedSBP = 0
      lnAgeUntreatedSBP = 0
      smokerCoef = 7.5740
      lnAgeSmoker = -1.6650
      diabeticCoef = 0.6610
      meanCoef = -29.1817
      baselineSurvival = 0.9665
    }
  } else {
    // Male
    if (race.toLowerCase() === 'black' || race.toLowerCase() === 'african american') {
      // Black male coefficients
      lnAge = 2.4690
      lnAgeSq = 0
      lnTotalChol = 0.3020
      lnAgeTotalChol = 0
      lnHDL = -0.3070
      lnAgeHDL = 0
      lnTreatedSBP = onBPMeds ? 1.9160 : 0
      lnUntreatedSBP = !onBPMeds ? 1.8090 : 0
      lnAgeTreatedSBP = 0
      lnAgeUntreatedSBP = 0
      smokerCoef = 0.5110
      lnAgeSmoker = 0
      diabeticCoef = 0.6580
      meanCoef = 19.5425
      baselineSurvival = 0.8954
    } else {
      // White/other male coefficients
      lnAge = 12.3440
      lnAgeSq = 0
      lnTotalChol = 11.8530
      lnAgeTotalChol = -2.6640
      lnHDL = -7.9900
      lnAgeHDL = 1.7690
      lnTreatedSBP = onBPMeds ? 1.7970 : 0
      lnUntreatedSBP = !onBPMeds ? 1.7640 : 0
      lnAgeTreatedSBP = 0
      lnAgeUntreatedSBP = 0
      smokerCoef = 7.8370
      lnAgeSmoker = -1.7950
      diabeticCoef = 0.6580
      meanCoef = 61.1816
      baselineSurvival = 0.9144
    }
  }

  // Calculate natural logs
  const lnAgeVal = Math.log(age)
  const lnAgeSqVal = Math.log(age) ** 2
  const lnTotalCholVal = Math.log(totalChol)
  const lnHDLVal = Math.log(hdl)
  const lnSBPVal = Math.log(systolicBP)

  // Calculate individual sum
  const individualSum =
    lnAge * lnAgeVal +
    lnAgeSq * lnAgeSqVal +
    lnTotalChol * lnTotalCholVal +
    lnAgeTotalChol * lnAgeVal * lnTotalCholVal +
    lnHDL * lnHDLVal +
    lnAgeHDL * lnAgeVal * lnHDLVal +
    (onBPMeds ? lnTreatedSBP * lnSBPVal : lnUntreatedSBP * lnSBPVal) +
    (onBPMeds ? lnAgeTreatedSBP * lnAgeVal * lnSBPVal : lnAgeUntreatedSBP * lnAgeVal * lnSBPVal) +
    (smoker ? smokerCoef : 0) +
    (smoker ? lnAgeSmoker * lnAgeVal : 0) +
    (diabetic ? diabeticCoef : 0)

  // Calculate 10-year risk
  let riskScore = 1 - Math.pow(baselineSurvival, Math.exp(individualSum - meanCoef))

  // Ensure risk is between 0 and 1
  riskScore = Math.max(0, Math.min(1, riskScore))

  // Categorize risk
  let category: string
  if (riskScore < 0.05) {
    category = 'low'
  } else if (riskScore < 0.075) {
    category = 'borderline'
  } else if (riskScore < 0.20) {
    category = 'intermediate'
  } else {
    category = 'high'
  }

  return {
    score: Number(riskScore.toFixed(4)),
    category,
    percentage: Number((riskScore * 100).toFixed(2))
  }
}
