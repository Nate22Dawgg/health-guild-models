/**
 * Advanced Lipids Calculators
 * 
 * Evidence-based cardiovascular risk assessment using advanced lipid markers.
 * All reference ranges and interpretations based on clinical cardiology guidelines.
 * 
 * Key References:
 * - American College of Cardiology (ACC) Guidelines
 * - European Society of Cardiology (ESC) Guidelines
 * - National Lipid Association (NLA) Recommendations
 */

export interface AdvancedLipidsInputs {
  // Advanced lipid markers
  apob?: number;                   // mg/dL (Apolipoprotein B)
  lp_a?: number;                   // mg/dL (Lipoprotein(a))
  ldl_p?: number;                  // nmol/L (LDL Particle Number)
  
  // Standard lipids (for context)
  ldl?: number;                    // mg/dL (LDL cholesterol)
  hdl?: number;                    // mg/dL (HDL cholesterol)
  total_chol?: number;             // mg/dL (Total cholesterol)
  triglycerides?: number;          // mg/dL
  
  // Context
  sex?: 'male' | 'female';
  age?: number;
}

export interface AdvancedLipidsAssessment {
  overall_status: 'optimal' | 'suboptimal' | 'concerning' | 'unknown';
  severity?: 'mild' | 'moderate' | 'severe';
  interpretation: string;
  recommendations: string[];
  cv_risk_level?: 'low' | 'moderate' | 'high' | 'very_high';
  calculated_ratios?: {
    apob_apoa1_ratio?: number;
    ldl_p_ldl_c_discordance?: string;
  };
  markers_analyzed: string[];
  models_ran: Array<{
    name: string;
    result: string;
    evidence_tier: 'A' | 'B' | 'C';
  }>;
}

/**
 * Assess advanced lipids panel
 * Integrates ApoB, Lp(a), and LDL-P into comprehensive CV risk assessment
 */
export function assessAdvancedLipids(inputs: AdvancedLipidsInputs): AdvancedLipidsAssessment {
  const markers: string[] = [];
  const models: Array<{ name: string; result: string; evidence_tier: 'A' | 'B' | 'C' }> = [];
  const recommendations: string[] = [];
  let concernLevel = 0; // 0=optimal, 1=suboptimal, 2=concerning
  
  const interpretations: string[] = [];
  const calculated_ratios: any = {};
  let cv_risk_level: 'low' | 'moderate' | 'high' | 'very_high' = 'low';

  // ApoB assessment
  if (inputs.apob !== undefined) {
    markers.push('apob');
    const apobResult = assessApoB(inputs.apob);
    models.push({
      name: 'Apolipoprotein B (ApoB)',
      result: apobResult.status,
      evidence_tier: 'A'
    });
    interpretations.push(apobResult.interpretation);
    recommendations.push(...apobResult.recommendations);
    concernLevel = Math.max(concernLevel, apobResult.concernLevel);
    cv_risk_level = apobResult.riskLevel;
  }

  // Lp(a) assessment
  if (inputs.lp_a !== undefined) {
    markers.push('lp_a');
    const lpaResult = assessLipoproteinA(inputs.lp_a);
    models.push({
      name: 'Lipoprotein(a)',
      result: lpaResult.status,
      evidence_tier: 'A'
    });
    interpretations.push(lpaResult.interpretation);
    recommendations.push(...lpaResult.recommendations);
    concernLevel = Math.max(concernLevel, lpaResult.concernLevel);
    
    // Upgrade CV risk if Lp(a) is very high
    if (lpaResult.riskLevel === 'very_high') {
      cv_risk_level = 'very_high';
    } else if (lpaResult.riskLevel === 'high' && cv_risk_level !== 'very_high') {
      cv_risk_level = 'high';
    }
  }

  // LDL-P assessment
  if (inputs.ldl_p !== undefined) {
    markers.push('ldl_p');
    const ldlpResult = assessLDLParticles(inputs.ldl_p);
    models.push({
      name: 'LDL Particle Number (LDL-P)',
      result: ldlpResult.status,
      evidence_tier: 'B'
    });
    interpretations.push(ldlpResult.interpretation);
    recommendations.push(...ldlpResult.recommendations);
    concernLevel = Math.max(concernLevel, ldlpResult.concernLevel);
  }

  // LDL-P vs LDL-C discordance analysis
  if (inputs.ldl_p !== undefined && inputs.ldl !== undefined) {
    const discordance = analyzeLDLDiscordance(inputs.ldl_p, inputs.ldl);
    calculated_ratios.ldl_p_ldl_c_discordance = discordance.status;
    
    models.push({
      name: 'LDL-P/LDL-C Discordance Analysis',
      result: discordance.status,
      evidence_tier: 'B'
    });
    interpretations.push(discordance.interpretation);
    recommendations.push(...discordance.recommendations);
    concernLevel = Math.max(concernLevel, discordance.concernLevel);
  }

  // ApoB/ApoA1 ratio (if HDL available to estimate ApoA1)
  if (inputs.apob !== undefined && inputs.hdl !== undefined) {
    // ApoA1 approximation: HDL × 1.2 (rough estimate)
    const apoa1_estimate = inputs.hdl * 1.2;
    const ratio = inputs.apob / apoa1_estimate;
    calculated_ratios.apob_apoa1_ratio = Math.round(ratio * 100) / 100;
    
    let ratioInterpretation = '';
    if (ratio < 0.6) {
      ratioInterpretation = `ApoB/ApoA1 ratio is ${ratio.toFixed(2)}, optimal for cardiovascular health.`;
    } else if (ratio >= 0.6 && ratio < 0.8) {
      ratioInterpretation = `ApoB/ApoA1 ratio is ${ratio.toFixed(2)}, borderline. Consider lifestyle optimization.`;
      concernLevel = Math.max(concernLevel, 1);
    } else {
      ratioInterpretation = `ApoB/ApoA1 ratio is ${ratio.toFixed(2)}, elevated. Indicates increased CV risk.`;
      concernLevel = Math.max(concernLevel, 2);
      recommendations.push('ApoB/ApoA1 ratio >0.8 suggests metabolic dysfunction and increased atherosclerosis risk');
    }
    
    models.push({
      name: 'ApoB/ApoA1 Ratio',
      result: ratioInterpretation,
      evidence_tier: 'B'
    });
    interpretations.push(ratioInterpretation);
  }

  // Determine overall status
  let overall_status: 'optimal' | 'suboptimal' | 'concerning' | 'unknown' = 'optimal';
  let severity: 'mild' | 'moderate' | 'severe' | undefined;
  
  if (concernLevel === 0) {
    overall_status = 'optimal';
  } else if (concernLevel === 1) {
    overall_status = 'suboptimal';
    severity = 'mild';
  } else if (concernLevel === 2) {
    overall_status = 'concerning';
    severity = 'moderate';
  } else if (concernLevel >= 3) {
    overall_status = 'concerning';
    severity = 'severe';
  }

  // Add general recommendations if concerning
  if (concernLevel >= 2) {
    recommendations.push('Consult with a cardiologist or lipidologist for comprehensive cardiovascular risk assessment');
  }

  // If no advanced lipids provided
  if (markers.length === 0) {
    return {
      overall_status: 'unknown',
      interpretation: 'No advanced lipid markers provided. Consider adding ApoB, Lp(a), or LDL-P for better CV risk assessment.',
      recommendations: ['Request advanced lipid panel from your healthcare provider'],
      markers_analyzed: [],
      models_ran: []
    };
  }

  return {
    overall_status,
    severity,
    interpretation: interpretations.join(' '),
    recommendations: Array.from(new Set(recommendations)),
    cv_risk_level,
    calculated_ratios,
    markers_analyzed: markers,
    models_ran: models
  };
}

/**
 * Assess Apolipoprotein B (ApoB)
 * ApoB = number of atherogenic particles (better than LDL cholesterol)
 */
function assessApoB(value: number): {
  status: string;
  interpretation: string;
  recommendations: string[];
  concernLevel: number;
  riskLevel: 'low' | 'moderate' | 'high' | 'very_high';
} {
  const recommendations: string[] = [];
  let status = '';
  let interpretation = '';
  let concernLevel = 0;
  let riskLevel: 'low' | 'moderate' | 'high' | 'very_high' = 'low';

  // ApoB thresholds (ACC/AHA guidelines)
  // Optimal: <80 mg/dL
  // Desirable: <90 mg/dL
  // Borderline: 90-130 mg/dL
  // High: >130 mg/dL

  if (value < 80) {
    status = 'Optimal ApoB';
    interpretation = `ApoB is ${value} mg/dL, optimal. Low number of atherogenic particles, minimal atherosclerosis risk.`;
    riskLevel = 'low';
    concernLevel = 0;
  } else if (value >= 80 && value < 90) {
    status = 'Desirable ApoB';
    interpretation = `ApoB is ${value} mg/dL, desirable. Acceptable cardiovascular risk.`;
    riskLevel = 'low';
    concernLevel = 0;
  } else if (value >= 90 && value < 110) {
    status = 'Borderline elevated ApoB';
    interpretation = `ApoB is ${value} mg/dL, borderline elevated. Increased atherosclerotic particle burden.`;
    recommendations.push('Optimize diet (reduce saturated fat, increase fiber), regular exercise, maintain healthy weight');
    riskLevel = 'moderate';
    concernLevel = 1;
  } else if (value >= 110 && value < 130) {
    status = 'Elevated ApoB';
    interpretation = `ApoB is ${value} mg/dL, elevated. Significantly increased CV risk due to high atherogenic particle count.`;
    recommendations.push('Consider statin therapy to reduce ApoB below 90 mg/dL');
    recommendations.push('Aggressive lifestyle modification: Mediterranean diet, daily exercise, weight loss if overweight');
    riskLevel = 'high';
    concernLevel = 2;
  } else {
    status = 'Very high ApoB';
    interpretation = `ApoB is ${value} mg/dL, very high. Substantially elevated atherosclerosis risk requiring urgent intervention.`;
    recommendations.push('URGENT: High-intensity statin therapy recommended (target ApoB <80 mg/dL)');
    recommendations.push('Consider PCSK9 inhibitors if statin insufficient');
    recommendations.push('Cardiology referral for comprehensive risk stratification');
    riskLevel = 'very_high';
    concernLevel = 3;
  }

  return { status, interpretation, recommendations, concernLevel, riskLevel };
}

/**
 * Assess Lipoprotein(a) - Lp(a)
 * Genetic CV risk factor, not modifiable by diet/exercise
 */
function assessLipoproteinA(value: number): {
  status: string;
  interpretation: string;
  recommendations: string[];
  concernLevel: number;
  riskLevel: 'low' | 'moderate' | 'high' | 'very_high';
} {
  const recommendations: string[] = [];
  let status = '';
  let interpretation = '';
  let concernLevel = 0;
  let riskLevel: 'low' | 'moderate' | 'high' | 'very_high' = 'low';

  // Lp(a) thresholds (ESC/ACC guidelines)
  // Optimal: <30 mg/dL
  // Borderline: 30-50 mg/dL
  // High: >50 mg/dL
  // Very high: >75 mg/dL (2-3x CV risk)

  if (value < 30) {
    status = 'Optimal Lp(a)';
    interpretation = `Lp(a) is ${value} mg/dL, optimal. Low genetic cardiovascular risk.`;
    riskLevel = 'low';
    concernLevel = 0;
  } else if (value >= 30 && value < 50) {
    status = 'Borderline elevated Lp(a)';
    interpretation = `Lp(a) is ${value} mg/dL, borderline elevated. Moderately increased CV risk (~1.5x).`;
    recommendations.push('Lp(a) is genetically determined and not modifiable by lifestyle');
    recommendations.push('Optimize other CV risk factors (LDL, blood pressure, smoking cessation)');
    riskLevel = 'moderate';
    concernLevel = 1;
  } else if (value >= 50 && value < 75) {
    status = 'Elevated Lp(a)';
    interpretation = `Lp(a) is ${value} mg/dL, elevated. Significantly increased CV risk (~2x normal).`;
    recommendations.push('Elevated Lp(a) is a GENETIC risk factor (80% heritable, not diet-modifiable)');
    recommendations.push('Aggressive management of modifiable risk factors essential');
    recommendations.push('Consider earlier statin therapy, target LDL <70 mg/dL');
    recommendations.push('Screen first-degree relatives for elevated Lp(a)');
    riskLevel = 'high';
    concernLevel = 2;
  } else {
    status = 'Very high Lp(a)';
    interpretation = `Lp(a) is ${value} mg/dL, very high. Substantially elevated CV risk (~3x normal) requiring intensive management.`;
    recommendations.push('CRITICAL: Lp(a) >75 mg/dL confers 2-3x cardiovascular event risk');
    recommendations.push('This is a GENETIC risk factor - siblings/children should be screened');
    recommendations.push('Aggressive LDL lowering: Target <55 mg/dL (consider PCSK9 inhibitors)');
    recommendations.push('Cardiology referral for apheresis consideration if CV events occur despite optimal therapy');
    recommendations.push('Novel therapies in trials: ASO (antisense oligonucleotides) targeting Lp(a) production');
    riskLevel = 'very_high';
    concernLevel = 3;
  }

  return { status, interpretation, recommendations, concernLevel, riskLevel };
}

/**
 * Assess LDL Particle Number (LDL-P)
 * Direct measurement of atherogenic particle count
 */
function assessLDLParticles(value: number): {
  status: string;
  interpretation: string;
  recommendations: string[];
  concernLevel: number;
} {
  const recommendations: string[] = [];
  let status = '';
  let interpretation = '';
  let concernLevel = 0;

  // LDL-P thresholds (NMR LipoProfile)
  // Optimal: <1000 nmol/L
  // Near optimal: 1000-1300 nmol/L
  // Borderline: 1300-1600 nmol/L
  // High: >1600 nmol/L

  if (value < 1000) {
    status = 'Optimal LDL-P';
    interpretation = `LDL-P is ${value} nmol/L, optimal. Low atherogenic particle burden.`;
    concernLevel = 0;
  } else if (value >= 1000 && value < 1300) {
    status = 'Near optimal LDL-P';
    interpretation = `LDL-P is ${value} nmol/L, near optimal. Acceptable particle count.`;
    concernLevel = 0;
  } else if (value >= 1300 && value < 1600) {
    status = 'Borderline elevated LDL-P';
    interpretation = `LDL-P is ${value} nmol/L, borderline elevated. Increased atherogenic particle burden.`;
    recommendations.push('Target LDL-P <1300 nmol/L through diet optimization and exercise');
    concernLevel = 1;
  } else if (value >= 1600 && value < 2000) {
    status = 'Elevated LDL-P';
    interpretation = `LDL-P is ${value} nmol/L, elevated. High cardiovascular risk due to particle excess.`;
    recommendations.push('Consider statin therapy to reduce LDL-P below 1300 nmol/L');
    concernLevel = 2;
  } else {
    status = 'Very high LDL-P';
    interpretation = `LDL-P is ${value} nmol/L, very high. Substantially elevated atherosclerosis risk.`;
    recommendations.push('High-intensity statin therapy recommended');
    concernLevel = 3;
  }

  return { status, interpretation, recommendations, concernLevel };
}

/**
 * Analyze LDL-P vs LDL-C discordance
 * Detects hidden cardiovascular risk when particle number exceeds cholesterol content
 */
function analyzeLDLDiscordance(ldl_p: number, ldl_c: number): {
  status: string;
  interpretation: string;
  recommendations: string[];
  concernLevel: number;
} {
  const recommendations: string[] = [];
  let status = '';
  let interpretation = '';
  let concernLevel = 0;

  // Convert LDL-P to estimated LDL-C equivalent for comparison
  // Rule of thumb: LDL-P of 1000 nmol/L ≈ LDL-C of 100 mg/dL
  const ldl_c_from_ldl_p = ldl_p / 10;

  const difference = ldl_c_from_ldl_p - ldl_c;
  const percentDiff = (difference / ldl_c) * 100;

  if (Math.abs(percentDiff) < 15) {
    status = 'Concordant (LDL-P and LDL-C agree)';
    interpretation = `LDL-P (${ldl_p} nmol/L) and LDL-C (${ldl_c} mg/dL) are concordant. Particle number matches cholesterol content.`;
    concernLevel = 0;
  } else if (percentDiff >= 15 && percentDiff < 30) {
    status = 'Moderately discordant (LDL-P > LDL-C)';
    interpretation = `LDL-P (${ldl_p} nmol/L) is higher than expected based on LDL-C (${ldl_c} mg/dL). More small, dense LDL particles (pattern B).`;
    recommendations.push('Discordant LDL-P/LDL-C indicates hidden CV risk - standard LDL-C underestimates true risk');
    recommendations.push('Small, dense LDL particles are more atherogenic - prioritize LDL-P over LDL-C for risk assessment');
    recommendations.push('Common in metabolic syndrome, prediabetes, insulin resistance');
    concernLevel = 1;
  } else if (percentDiff >= 30) {
    status = 'Highly discordant (LDL-P >> LDL-C)';
    interpretation = `LDL-P (${ldl_p} nmol/L) is significantly higher than LDL-C (${ldl_c} mg/dL). Substantially underestimated CV risk by standard lipid panel.`;
    recommendations.push('CRITICAL: Standard LDL-C dramatically underestimates your cardiovascular risk');
    recommendations.push('High LDL-P with "normal" LDL-C is a red flag for metabolic dysfunction');
    recommendations.push('Evaluate for insulin resistance (HOMA-IR), metabolic syndrome, prediabetes');
    recommendations.push('Aggressive LDL-P lowering: Target <1000 nmol/L with statin + lifestyle');
    concernLevel = 2;
  } else if (percentDiff < -15) {
    status = 'Reverse discordant (LDL-C > LDL-P)';
    interpretation = `LDL-C (${ldl_c} mg/dL) is higher than expected based on LDL-P (${ldl_p} nmol/L). Large, buoyant LDL particles (pattern A) - less atherogenic.`;
    recommendations.push('Reverse discordance (high LDL-C, lower LDL-P) suggests less atherogenic large LDL particles');
    concernLevel = 0;
  }

  return { status, interpretation, recommendations, concernLevel };
}
