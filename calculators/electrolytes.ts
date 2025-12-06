/**
 * Electrolytes Panel Calculators
 * 
 * Evidence-based electrolyte analysis for metabolic and renal health.
 * All reference ranges based on clinical laboratory guidelines.
 * 
 * Key References:
 * - Clinical Laboratory Standards Institute (CLSI)
 * - American Association for Clinical Chemistry (AACC)
 */

export interface ElectrolytesInputs {
  sodium?: number;        // mEq/L or mmol/L
  potassium?: number;     // mEq/L or mmol/L
  chloride?: number;      // mEq/L or mmol/L
  co2?: number;           // mEq/L (bicarbonate/total CO2)
  
  // Context
  age?: number;
}

export interface ElectrolytesAssessment {
  overall_status: 'optimal' | 'suboptimal' | 'concerning' | 'unknown';
  severity?: 'mild' | 'moderate' | 'severe';
  interpretation: string;
  recommendations: string[];
  markers_analyzed: string[];
  models_ran: Array<{
    name: string;
    result: string;
    evidence_tier: 'A' | 'B' | 'C';
  }>;
}

/**
 * Assess electrolytes panel
 */
export function assessElectrolytes(inputs: ElectrolytesInputs): ElectrolytesAssessment {
  const markers: string[] = [];
  const models: Array<{ name: string; result: string; evidence_tier: 'A' | 'B' | 'C' }> = [];
  const recommendations: string[] = [];
  let concernLevel = 0;
  
  const interpretations: string[] = [];

  // Sodium assessment
  if (inputs.sodium !== undefined) {
    markers.push('sodium');
    const naResult = assessSodium(inputs.sodium);
    models.push({
      name: 'Sodium Assessment',
      result: naResult.status,
      evidence_tier: 'A'
    });
    interpretations.push(naResult.interpretation);
    recommendations.push(...naResult.recommendations);
    concernLevel = Math.max(concernLevel, naResult.concernLevel);
  }

  // Potassium assessment
  if (inputs.potassium !== undefined) {
    markers.push('potassium');
    const kResult = assessPotassium(inputs.potassium);
    models.push({
      name: 'Potassium Assessment',
      result: kResult.status,
      evidence_tier: 'A'
    });
    interpretations.push(kResult.interpretation);
    recommendations.push(...kResult.recommendations);
    concernLevel = Math.max(concernLevel, kResult.concernLevel);
  }

  // Chloride assessment
  if (inputs.chloride !== undefined) {
    markers.push('chloride');
    const clResult = assessChloride(inputs.chloride);
    models.push({
      name: 'Chloride Assessment',
      result: clResult.status,
      evidence_tier: 'A'
    });
    interpretations.push(clResult.interpretation);
    recommendations.push(...clResult.recommendations);
    concernLevel = Math.max(concernLevel, clResult.concernLevel);
  }

  // CO2/Bicarbonate assessment
  if (inputs.co2 !== undefined) {
    markers.push('co2');
    const co2Result = assessCO2(inputs.co2);
    models.push({
      name: 'CO2/Bicarbonate Assessment',
      result: co2Result.status,
      evidence_tier: 'A'
    });
    interpretations.push(co2Result.interpretation);
    recommendations.push(...co2Result.recommendations);
    concernLevel = Math.max(concernLevel, co2Result.concernLevel);
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

  if (markers.length === 0) {
    return {
      overall_status: 'unknown',
      interpretation: 'No electrolyte markers provided',
      recommendations: [],
      markers_analyzed: [],
      models_ran: []
    };
  }

  return {
    overall_status,
    severity,
    interpretation: interpretations.join(' '),
    recommendations: Array.from(new Set(recommendations)),
    markers_analyzed: markers,
    models_ran: models
  };
}

function assessSodium(value: number): {
  status: string;
  interpretation: string;
  recommendations: string[];
  concernLevel: number;
} {
  const recommendations: string[] = [];
  let status = '';
  let interpretation = '';
  let concernLevel = 0;

  // Normal: 136-145 mEq/L
  if (value < 130) {
    status = 'Severe hyponatremia';
    interpretation = `Sodium is ${value} mEq/L, critically low. Risk of seizures, coma.`;
    recommendations.push('URGENT: Severe hyponatremia requires immediate medical attention');
    recommendations.push('Causes: SIADH, heart failure, cirrhosis, diuretics');
    concernLevel = 3;
  } else if (value >= 130 && value < 136) {
    status = 'Mild hyponatremia';
    interpretation = `Sodium is ${value} mEq/L, low. May cause confusion, fatigue.`;
    recommendations.push('Evaluate for fluid overload, SIADH, or medication effects');
    concernLevel = 1;
  } else if (value >= 136 && value <= 145) {
    status = 'Normal sodium';
    interpretation = `Sodium is ${value} mEq/L, normal.`;
    concernLevel = 0;
  } else if (value > 145 && value <= 150) {
    status = 'Mild hypernatremia';
    interpretation = `Sodium is ${value} mEq/L, elevated. May indicate dehydration.`;
    recommendations.push('Increase fluid intake, evaluate for dehydration or diabetes insipidus');
    concernLevel = 1;
  } else {
    status = 'Severe hypernatremia';
    interpretation = `Sodium is ${value} mEq/L, critically high. Risk of neurological damage.`;
    recommendations.push('URGENT: Severe hypernatremia requires immediate rehydration');
    concernLevel = 3;
  }

  return { status, interpretation, recommendations, concernLevel };
}

function assessPotassium(value: number): {
  status: string;
  interpretation: string;
  recommendations: string[];
  concernLevel: number;
} {
  const recommendations: string[] = [];
  let status = '';
  let interpretation = '';
  let concernLevel = 0;

  // Normal: 3.5-5.0 mEq/L
  if (value < 3.0) {
    status = 'Severe hypokalemia';
    interpretation = `Potassium is ${value} mEq/L, critically low. Risk of cardiac arrhythmias.`;
    recommendations.push('URGENT: Severe hypokalemia requires immediate potassium replacement');
    recommendations.push('Monitor EKG for arrhythmias');
    concernLevel = 3;
  } else if (value >= 3.0 && value < 3.5) {
    status = 'Mild hypokalemia';
    interpretation = `Potassium is ${value} mEq/L, low. May cause muscle weakness, fatigue.`;
    recommendations.push('Increase dietary potassium (bananas, potatoes, leafy greens)');
    recommendations.push('Evaluate for diuretic use or GI losses');
    concernLevel = 1;
  } else if (value >= 3.5 && value <= 5.0) {
    status = 'Normal potassium';
    interpretation = `Potassium is ${value} mEq/L, normal.`;
    concernLevel = 0;
  } else if (value > 5.0 && value <= 5.5) {
    status = 'Mild hyperkalemia';
    interpretation = `Potassium is ${value} mEq/L, elevated. May indicate kidney dysfunction.`;
    recommendations.push('Reduce high-potassium foods, check kidney function');
    concernLevel = 1;
  } else {
    status = 'Severe hyperkalemia';
    interpretation = `Potassium is ${value} mEq/L, critically high. Risk of fatal cardiac arrhythmias.`;
    recommendations.push('URGENT: Severe hyperkalemia requires immediate treatment (calcium, insulin/glucose)');
    recommendations.push('Monitor EKG, evaluate for kidney failure or medications');
    concernLevel = 3;
  }

  return { status, interpretation, recommendations, concernLevel };
}

function assessChloride(value: number): {
  status: string;
  interpretation: string;
  recommendations: string[];
  concernLevel: number;
} {
  const recommendations: string[] = [];
  let status = '';
  let interpretation = '';
  let concernLevel = 0;

  // Normal: 98-106 mEq/L
  if (value < 95) {
    status = 'Hypochloremia';
    interpretation = `Chloride is ${value} mEq/L, low. May indicate metabolic alkalosis or fluid loss.`;
    recommendations.push('Evaluate for vomiting, diuretic use, or respiratory acidosis compensation');
    concernLevel = 1;
  } else if (value >= 95 && value <= 106) {
    status = 'Normal chloride';
    interpretation = `Chloride is ${value} mEq/L, normal.`;
    concernLevel = 0;
  } else {
    status = 'Hyperchloremia';
    interpretation = `Chloride is ${value} mEq/L, elevated. May indicate metabolic acidosis or dehydration.`;
    recommendations.push('Evaluate for metabolic acidosis, diarrhea, or renal tubular acidosis');
    concernLevel = 1;
  }

  return { status, interpretation, recommendations, concernLevel };
}

function assessCO2(value: number): {
  status: string;
  interpretation: string;
  recommendations: string[];
  concernLevel: number;
} {
  const recommendations: string[] = [];
  let status = '';
  let interpretation = '';
  let concernLevel = 0;

  // Normal: 23-29 mEq/L
  if (value < 20) {
    status = 'Severe metabolic acidosis';
    interpretation = `CO2 is ${value} mEq/L, critically low. Indicates severe metabolic acidosis.`;
    recommendations.push('URGENT: Severe acidosis requires immediate evaluation');
    recommendations.push('Causes: DKA, lactic acidosis, renal failure, diarrhea');
    concernLevel = 3;
  } else if (value >= 20 && value < 23) {
    status = 'Mild metabolic acidosis';
    interpretation = `CO2 is ${value} mEq/L, low. May indicate metabolic acidosis.`;
    recommendations.push('Evaluate for kidney function, diabetes, diarrhea');
    concernLevel = 1;
  } else if (value >= 23 && value <= 29) {
    status = 'Normal CO2';
    interpretation = `CO2 is ${value} mEq/L, normal acid-base balance.`;
    concernLevel = 0;
  } else if (value > 29 && value <= 32) {
    status = 'Mild metabolic alkalosis';
    interpretation = `CO2 is ${value} mEq/L, elevated. May indicate metabolic alkalosis.`;
    recommendations.push('Evaluate for vomiting, diuretic use, or respiratory acidosis compensation');
    concernLevel = 1;
  } else {
    status = 'Severe metabolic alkalosis';
    interpretation = `CO2 is ${value} mEq/L, critically high. Significant metabolic alkalosis.`;
    recommendations.push('Evaluate for severe vomiting, nasogastric suction, or diuretic abuse');
    concernLevel = 2;
  }

  return { status, interpretation, recommendations, concernLevel };
}
