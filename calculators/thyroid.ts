/**
 * Thyroid Function Calculators
 * Evidence-based thyroid assessment tools
 */

export interface ThyroidFunctionResult {
  status: 'euthyroid' | 'hypothyroid' | 'hyperthyroid' | 'subclinical_hypothyroid' | 'subclinical_hyperthyroid' | 'low_t3_syndrome'
  severity: 'normal' | 'mild' | 'moderate' | 'severe'
  interpretation: string
  recommendations: string[]
}

/**
 * Comprehensive Thyroid Function Assessment
 * Integrates TSH, Free T3, Free T4 per clinical guidelines
 */
export function assessThyroidFunction(
  tsh: number,
  freeT3?: number,
  freeT4?: number
): ThyroidFunctionResult {
  // TSH-only assessment (most common screening)
  if (!freeT3 && !freeT4) {
    if (tsh >= 0.4 && tsh <= 4.0) {
      return {
        status: 'euthyroid',
        severity: 'normal',
        interpretation: 'Normal thyroid function based on TSH alone. Consider Free T3/T4 for complete assessment.',
        recommendations: ['Optimal TSH for longevity is 1.0-2.5 mIU/L', 'Consider Free T3/T4 if experiencing symptoms']
      }
    } else if (tsh > 4.0 && tsh <= 10.0) {
      return {
        status: 'subclinical_hypothyroid',
        severity: 'mild',
        interpretation: 'Mildly elevated TSH suggests subclinical hypothyroidism. Thyroid gland may be underactive.',
        recommendations: [
          'Repeat test in 2-3 months to confirm',
          'Check Free T4 and TPO antibodies',
          'Consider symptoms: fatigue, weight gain, cold intolerance',
          'Treatment usually recommended if TSH >10 or symptomatic'
        ]
      }
    } else if (tsh > 10.0) {
      return {
        status: 'hypothyroid',
        severity: 'moderate',
        interpretation: 'Significantly elevated TSH indicates hypothyroidism. Thyroid gland is underactive.',
        recommendations: [
          'Consult endocrinologist or primary care physician',
          'Check Free T4, Free T3, and TPO antibodies',
          'Levothyroxine therapy likely indicated',
          'Rule out autoimmune thyroiditis (Hashimoto\'s)'
        ]
      }
    } else if (tsh < 0.1) {
      return {
        status: 'hyperthyroid',
        severity: 'moderate',
        interpretation: 'Severely suppressed TSH indicates hyperthyroidism. Thyroid gland is overactive.',
        recommendations: [
          'Urgent consultation with endocrinologist',
          'Check Free T4, Free T3, and thyroid antibodies',
          'Rule out Graves\' disease, thyroid nodules, or thyroiditis',
          'Monitor for cardiac symptoms (palpitations, arrhythmias)'
        ]
      }
    } else {
      return {
        status: 'subclinical_hyperthyroid',
        severity: 'mild',
        interpretation: 'Mildly suppressed TSH suggests subclinical hyperthyroidism or overtreatment.',
        recommendations: [
          'Repeat test in 1-2 months',
          'Check Free T4 and Free T3',
          'If on thyroid medication, dose may need adjustment',
          'Monitor for hyperthyroid symptoms'
        ]
      }
    }
  }

  // Complete thyroid panel assessment (TSH + T3/T4)
  const t3Low = freeT3 !== undefined && freeT3 < 2.3
  const t3Normal = freeT3 !== undefined && freeT3 >= 2.3 && freeT3 <= 4.2
  const t3High = freeT3 !== undefined && freeT3 > 4.2
  
  const t4Low = freeT4 !== undefined && freeT4 < 0.8
  const t4Normal = freeT4 !== undefined && freeT4 >= 0.8 && freeT4 <= 1.8
  const t4High = freeT4 !== undefined && freeT4 > 1.8

  // Primary hypothyroidism (high TSH, low T4)
  if (tsh > 4.0 && t4Low) {
    return {
      status: 'hypothyroid',
      severity: tsh > 10.0 ? 'severe' : 'moderate',
      interpretation: 'Primary hypothyroidism confirmed. High TSH with low Free T4 indicates thyroid gland failure.',
      recommendations: [
        'Consult endocrinologist for levothyroxine therapy',
        'Check TPO antibodies for Hashimoto\'s disease',
        'Monitor for symptoms: fatigue, weight gain, cold intolerance, constipation',
        'Recheck labs in 6-8 weeks after starting treatment'
      ]
    }
  }

  // Primary hyperthyroidism (low TSH, high T4/T3)
  if (tsh < 0.4 && (t4High || t3High)) {
    return {
      status: 'hyperthyroid',
      severity: tsh < 0.1 ? 'severe' : 'moderate',
      interpretation: 'Primary hyperthyroidism confirmed. Suppressed TSH with elevated thyroid hormones.',
      recommendations: [
        'Urgent endocrinology consultation',
        'Check thyroid antibodies (TSI, TRAB) for Graves\' disease',
        'Consider thyroid ultrasound for nodules',
        'Monitor for symptoms: weight loss, heat intolerance, palpitations, anxiety',
        'Treatment options: anti-thyroid drugs, radioactive iodine, or surgery'
      ]
    }
  }

  // Low T3 syndrome (normal TSH, low T3, normal/low T4)
  if (tsh >= 0.4 && tsh <= 4.0 && t3Low && !t4High) {
    return {
      status: 'low_t3_syndrome',
      severity: 'mild',
      interpretation: 'Low T3 syndrome detected. Normal TSH but low Free T3 suggests poor T4-to-T3 conversion.',
      recommendations: [
        'Common in chronic illness, stress, or nutrient deficiencies',
        'Check ferritin, selenium, zinc (required for T4→T3 conversion)',
        'Assess for chronic inflammation or illness',
        'Consider reverse T3 to confirm',
        'Optimize nutrition and address underlying stressors'
      ]
    }
  }

  // Subclinical hypothyroidism (high TSH, normal T4)
  if (tsh > 4.0 && t4Normal) {
    return {
      status: 'subclinical_hypothyroid',
      severity: 'mild',
      interpretation: 'Subclinical hypothyroidism. Elevated TSH but normal Free T4 indicates early thyroid dysfunction.',
      recommendations: [
        'Repeat test in 2-3 months',
        'Check TPO antibodies (high risk if positive)',
        'Treatment usually recommended if TSH >10 or if symptomatic',
        'Monitor for progression to overt hypothyroidism'
      ]
    }
  }

  // Subclinical hyperthyroidism (low TSH, normal T4/T3)
  if (tsh < 0.4 && t4Normal && !t3High) {
    return {
      status: 'subclinical_hyperthyroid',
      severity: 'mild',
      interpretation: 'Subclinical hyperthyroidism. Suppressed TSH but normal thyroid hormones.',
      recommendations: [
        'Repeat test in 1-2 months',
        'If persistent, check thyroid antibodies',
        'Rule out thyroid medication overtreatment',
        'Monitor for progression to overt hyperthyroidism',
        'Consider cardiovascular monitoring if age >65'
      ]
    }
  }

  // Normal thyroid function
  return {
    status: 'euthyroid',
    severity: 'normal',
    interpretation: 'Normal thyroid function. TSH and thyroid hormones are within optimal ranges.',
    recommendations: [
      'Continue routine monitoring annually',
      'Optimal TSH for longevity: 1.0-2.5 mIU/L',
      'Maintain adequate iodine and selenium intake'
    ]
  }
}

/**
 * Free T3 to Reverse T3 Ratio
 * Marker of thyroid hormone metabolism and stress response
 * Optimal ratio: >0.2 (higher is better)
 */
export function calculateT3ReverseT3Ratio(freeT3: number, reverseT3: number): {
  ratio: number
  status: 'optimal' | 'borderline' | 'concerning'
  interpretation: string
} {
  if (freeT3 <= 0 || reverseT3 <= 0) {
    throw new Error('Free T3 and Reverse T3 must be positive values')
  }

  const ratio = freeT3 / reverseT3

  if (ratio >= 0.2) {
    return {
      ratio: Number(ratio.toFixed(3)),
      status: 'optimal',
      interpretation: 'Optimal T3:rT3 ratio. Good thyroid hormone metabolism and low stress burden.'
    }
  } else if (ratio >= 0.15) {
    return {
      ratio: Number(ratio.toFixed(3)),
      status: 'borderline',
      interpretation: 'Borderline T3:rT3 ratio. May indicate chronic stress or poor T4-to-T3 conversion.'
    }
  } else {
    return {
      ratio: Number(ratio.toFixed(3)),
      status: 'concerning',
      interpretation: 'Low T3:rT3 ratio. Suggests chronic stress, inflammation, or thyroid hormone resistance. Elevated reverse T3 blocks active T3.'
    }
  }
}

/**
 * Free T3 to Free T4 Ratio
 * Marker of T4-to-T3 conversion efficiency
 * Optimal ratio: 0.25-0.35
 */
export function calculateT3T4Ratio(freeT3: number, freeT4: number): {
  ratio: number
  status: 'low' | 'optimal' | 'high'
  interpretation: string
} {
  if (freeT3 <= 0 || freeT4 <= 0) {
    throw new Error('Free T3 and Free T4 must be positive values')
  }

  // Adjust units: T3 (pg/mL) / T4 (ng/dL) → convert T4 to pg/mL (multiply by 10)
  const ratio = freeT3 / (freeT4 * 10)

  if (ratio < 0.25) {
    return {
      ratio: Number(ratio.toFixed(3)),
      status: 'low',
      interpretation: 'Low T3:T4 ratio. Poor conversion of T4 to active T3. Check selenium, zinc, iron status. Rule out chronic illness or medication interference.'
    }
  } else if (ratio <= 0.35) {
    return {
      ratio: Number(ratio.toFixed(3)),
      status: 'optimal',
      interpretation: 'Optimal T3:T4 ratio. Good T4-to-T3 conversion efficiency.'
    }
  } else {
    return {
      ratio: Number(ratio.toFixed(3)),
      status: 'high',
      interpretation: 'High T3:T4 ratio. Excessive T4-to-T3 conversion or T3 supplementation. Rule out hyperthyroidism or overtreatment.'
    }
  }
}

/**
 * Hashimoto's Thyroiditis Risk Assessment
 * Based on TPO antibodies and thyroid function
 */
export function assessHashimotosRisk(
  tpoAntibodies: number,
  tsh?: number
): {
  risk: 'low' | 'moderate' | 'high'
  interpretation: string
  recommendations: string[]
} {
  if (tpoAntibodies < 9) {
    return {
      risk: 'low',
      interpretation: 'Negative TPO antibodies. Low risk for autoimmune thyroid disease.',
      recommendations: [
        'Routine thyroid monitoring',
        'Maintain healthy diet and stress management'
      ]
    }
  } else if (tpoAntibodies < 35) {
    return {
      risk: 'moderate',
      interpretation: 'Borderline TPO antibodies. Possible early autoimmune thyroid disease.',
      recommendations: [
        'Repeat TPO antibodies in 6-12 months',
        'Monitor TSH annually',
        'Consider gluten sensitivity testing (linked to autoimmune thyroid)',
        'Optimize selenium and vitamin D intake (may slow progression)'
      ]
    }
  } else {
    const tshElevated = tsh !== undefined && tsh > 4.0
    return {
      risk: 'high',
      interpretation: tshElevated 
        ? 'Positive TPO antibodies with elevated TSH confirms Hashimoto\'s thyroiditis.'
        : 'Positive TPO antibodies indicate autoimmune thyroid disease (Hashimoto\'s), though thyroid function may still be normal.',
      recommendations: [
        'Diagnose: Hashimoto\'s thyroiditis (autoimmune hypothyroidism)',
        'Monitor TSH every 3-6 months for progression',
        tshElevated ? 'Levothyroxine therapy likely indicated' : 'Treatment if TSH rises or symptoms develop',
        'Optimize selenium (200 mcg/day) - shown to reduce antibodies',
        'Consider gluten-free diet (may reduce inflammation)',
        'Monitor for other autoimmune conditions (celiac, type 1 diabetes, etc.)'
      ]
    }
  }
}
