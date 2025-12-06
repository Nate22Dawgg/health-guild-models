/**
 * Complete Blood Count (CBC) Calculators
 * 
 * Evidence-based hematology analysis for blood health assessment.
 * All reference ranges and interpretations based on clinical hematology guidelines.
 * 
 * Key References:
 * - American Society of Hematology (ASH) Guidelines
 * - World Health Organization (WHO) Anemia Criteria
 * - Clinical Laboratory Standards Institute (CLSI)
 */

export interface CBCInputs {
  // White blood cells
  wbc?: number;                    // × 10^9/L (or × 10^3/μL)
  
  // Red blood cells
  rbc?: number;                    // × 10^12/L (or × 10^6/μL)
  hemoglobin?: number;             // g/dL
  hematocrit?: number;             // %
  
  // Red cell indices
  mcv?: number;                    // fL (Mean Corpuscular Volume)
  mch?: number;                    // pg (Mean Corpuscular Hemoglobin)
  mchc?: number;                   // g/dL (Mean Corpuscular Hemoglobin Concentration)
  rdw?: number;                    // % (Red Cell Distribution Width)
  
  // Context
  sex?: 'male' | 'female';
  age?: number;
}

export interface CBCAssessment {
  overall_status: 'optimal' | 'suboptimal' | 'concerning' | 'unknown';
  severity?: 'mild' | 'moderate' | 'severe';
  interpretation: string;
  recommendations: string[];
  anemia_assessment?: {
    has_anemia: boolean;
    type?: 'microcytic' | 'macrocytic' | 'normocytic';
    likely_causes?: string[];
  };
  markers_analyzed: string[];
  models_ran: Array<{
    name: string;
    result: string;
    evidence_tier: 'A' | 'B' | 'C';
  }>;
}

/**
 * Assess complete blood count panel
 * Integrates all CBC markers into comprehensive assessment
 */
export function assessCBC(inputs: CBCInputs): CBCAssessment {
  const markers: string[] = [];
  const models: Array<{ name: string; result: string; evidence_tier: 'A' | 'B' | 'C' }> = [];
  const recommendations: string[] = [];
  let concernLevel = 0; // 0=optimal, 1=suboptimal, 2=concerning
  
  const interpretations: string[] = [];

  // White Blood Cell assessment
  if (inputs.wbc !== undefined) {
    markers.push('wbc');
    const wbcResult = assessWBC(inputs.wbc);
    models.push({
      name: 'White Blood Cell Count',
      result: wbcResult.status,
      evidence_tier: 'A'
    });
    interpretations.push(wbcResult.interpretation);
    recommendations.push(...wbcResult.recommendations);
    concernLevel = Math.max(concernLevel, wbcResult.concernLevel);
  }

  // Anemia assessment (requires hemoglobin or hematocrit)
  let anemiaAssessment: CBCAssessment['anemia_assessment'];
  
  if (inputs.hemoglobin !== undefined || inputs.hematocrit !== undefined) {
    if (inputs.hemoglobin) markers.push('hemoglobin');
    if (inputs.hematocrit) markers.push('hematocrit');
    
    const anemiaResult = assessAnemia(
      inputs.hemoglobin,
      inputs.hematocrit,
      inputs.sex,
      inputs.mcv,
      inputs.rdw
    );
    
    anemiaAssessment = {
      has_anemia: anemiaResult.hasAnemia,
      type: anemiaResult.anemiaType,
      likely_causes: anemiaResult.likelyCauses
    };
    
    models.push({
      name: 'Anemia Assessment',
      result: anemiaResult.status,
      evidence_tier: 'A'
    });
    interpretations.push(anemiaResult.interpretation);
    recommendations.push(...anemiaResult.recommendations);
    concernLevel = Math.max(concernLevel, anemiaResult.concernLevel);
  }

  // Red Blood Cell assessment
  if (inputs.rbc !== undefined) {
    markers.push('rbc');
    const rbcResult = assessRBC(inputs.rbc, inputs.sex);
    models.push({
      name: 'Red Blood Cell Count',
      result: rbcResult.status,
      evidence_tier: 'A'
    });
    interpretations.push(rbcResult.interpretation);
    recommendations.push(...rbcResult.recommendations);
    concernLevel = Math.max(concernLevel, rbcResult.concernLevel);
  }

  // MCV assessment (red cell size)
  if (inputs.mcv !== undefined) {
    markers.push('mcv');
    const mcvResult = assessMCV(inputs.mcv);
    models.push({
      name: 'Mean Corpuscular Volume (MCV)',
      result: mcvResult.status,
      evidence_tier: 'A'
    });
    interpretations.push(mcvResult.interpretation);
    recommendations.push(...mcvResult.recommendations);
    concernLevel = Math.max(concernLevel, mcvResult.concernLevel);
  }

  // MCH assessment
  if (inputs.mch !== undefined) {
    markers.push('mch');
    const mchResult = assessMCH(inputs.mch);
    models.push({
      name: 'Mean Corpuscular Hemoglobin (MCH)',
      result: mchResult.status,
      evidence_tier: 'B'
    });
    if (mchResult.interpretation) interpretations.push(mchResult.interpretation);
    concernLevel = Math.max(concernLevel, mchResult.concernLevel);
  }

  // MCHC assessment
  if (inputs.mchc !== undefined) {
    markers.push('mchc');
    const mchcResult = assessMCHC(inputs.mchc);
    models.push({
      name: 'Mean Corpuscular Hemoglobin Concentration (MCHC)',
      result: mchcResult.status,
      evidence_tier: 'B'
    });
    if (mchcResult.interpretation) interpretations.push(mchcResult.interpretation);
    concernLevel = Math.max(concernLevel, mchcResult.concernLevel);
  }

  // RDW assessment (red cell variation)
  if (inputs.rdw !== undefined) {
    markers.push('rdw');
    const rdwResult = assessRDW(inputs.rdw);
    models.push({
      name: 'Red Cell Distribution Width (RDW)',
      result: rdwResult.status,
      evidence_tier: 'B'
    });
    interpretations.push(rdwResult.interpretation);
    recommendations.push(...rdwResult.recommendations);
    concernLevel = Math.max(concernLevel, rdwResult.concernLevel);
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
    recommendations.push('Consult with a hematologist or primary care physician for comprehensive blood work evaluation');
  }

  return {
    overall_status,
    severity,
    interpretation: interpretations.join(' '),
    recommendations: Array.from(new Set(recommendations)),
    anemia_assessment: anemiaAssessment,
    markers_analyzed: markers,
    models_ran: models
  };
}

/**
 * Assess white blood cell count (immune function)
 */
function assessWBC(value: number): {
  status: string;
  interpretation: string;
  recommendations: string[];
  concernLevel: number;
} {
  const recommendations: string[] = [];
  let status = '';
  let interpretation = '';
  let concernLevel = 0;

  // Normal range: 4.5-11.0 × 10^9/L
  if (value < 3.5) {
    status = 'Leukopenia (low WBC)';
    interpretation = `WBC is ${value} × 10⁹/L, significantly low. May indicate bone marrow suppression, viral infection, or autoimmune disease.`;
    recommendations.push('Evaluate for bone marrow disorders, viral infections (HIV, hepatitis), or autoimmune conditions');
    recommendations.push('Check WBC differential to identify which cell type is affected');
    concernLevel = 3;
  } else if (value >= 3.5 && value < 4.5) {
    status = 'Low-normal WBC';
    interpretation = `WBC is ${value} × 10⁹/L, in the low-normal range. Monitor for trends.`;
    recommendations.push('Recheck WBC in 3-6 months to monitor for downward trend');
    concernLevel = 1;
  } else if (value >= 4.5 && value <= 11.0) {
    status = 'Optimal WBC';
    interpretation = `WBC is ${value} × 10⁹/L, optimal for immune function.`;
    concernLevel = 0;
  } else if (value > 11.0 && value <= 15.0) {
    status = 'Elevated WBC';
    interpretation = `WBC is ${value} × 10⁹/L, elevated. May indicate infection, inflammation, or stress response.`;
    recommendations.push('Check WBC differential to identify cell type elevation');
    recommendations.push('Common causes: bacterial infection, inflammatory conditions, smoking, stress');
    concernLevel = 1;
  } else {
    status = 'Significantly elevated WBC (Leukocytosis)';
    interpretation = `WBC is ${value} × 10⁹/L, significantly elevated. Warrants immediate evaluation for infection, leukemia, or inflammatory disorders.`;
    recommendations.push('Urgent evaluation: WBC differential, blood smear, consider hematology referral');
    recommendations.push('Rule out leukemia, severe infection, or myeloproliferative disorders');
    concernLevel = 3;
  }

  return { status, interpretation, recommendations, concernLevel };
}

/**
 * Assess anemia (low hemoglobin/hematocrit) and classify by type
 */
function assessAnemia(
  hemoglobin?: number,
  hematocrit?: number,
  sex?: 'male' | 'female',
  mcv?: number,
  rdw?: number
): {
  status: string;
  interpretation: string;
  recommendations: string[];
  concernLevel: number;
  hasAnemia: boolean;
  anemiaType?: 'microcytic' | 'macrocytic' | 'normocytic';
  likelyCauses?: string[];
} {
  const recommendations: string[] = [];
  let status = '';
  let interpretation = '';
  let concernLevel = 0;
  let hasAnemia = false;
  let anemiaType: 'microcytic' | 'macrocytic' | 'normocytic' | undefined;
  let likelyCauses: string[] = [];

  // WHO anemia criteria
  // Male: Hgb <13 g/dL, Female: Hgb <12 g/dL
  // Hematocrit: Male <39%, Female <36%
  
  const maleThreshold = 13;
  const femaleThreshold = 12;
  const threshold = sex === 'male' ? maleThreshold : femaleThreshold;

  if (hemoglobin !== undefined) {
    hasAnemia = hemoglobin < threshold;
    
    if (hasAnemia) {
      // Classify anemia by severity
      if (hemoglobin < 8) {
        status = 'Severe anemia';
        interpretation = `Hemoglobin is ${hemoglobin} g/dL, severely low. Requires urgent medical attention.`;
        concernLevel = 3;
        recommendations.push('URGENT: Severe anemia requires immediate medical evaluation and possible blood transfusion');
      } else if (hemoglobin < 10) {
        status = 'Moderate anemia';
        interpretation = `Hemoglobin is ${hemoglobin} g/dL, moderately low.`;
        concernLevel = 2;
        recommendations.push('Moderate anemia requires prompt medical evaluation and treatment');
      } else {
        status = 'Mild anemia';
        interpretation = `Hemoglobin is ${hemoglobin} g/dL, mildly low for ${sex || 'adults'}.`;
        concernLevel = 1;
        recommendations.push('Mild anemia should be evaluated to identify underlying cause');
      }

      // Classify anemia by MCV (red cell size)
      if (mcv !== undefined) {
        if (mcv < 80) {
          anemiaType = 'microcytic';
          interpretation += ' Microcytic anemia (small red cells).';
          likelyCauses = ['Iron deficiency (most common)', 'Thalassemia', 'Chronic disease', 'Lead poisoning'];
          recommendations.push('Check iron panel (ferritin, TIBC, serum iron), consider thalassemia screening');
        } else if (mcv > 100) {
          anemiaType = 'macrocytic';
          interpretation += ' Macrocytic anemia (large red cells).';
          likelyCauses = ['Vitamin B12 deficiency', 'Folate deficiency', 'Hypothyroidism', 'Alcohol use', 'Liver disease'];
          recommendations.push('Check vitamin B12, folate, thyroid function (TSH), liver enzymes');
        } else {
          anemiaType = 'normocytic';
          interpretation += ' Normocytic anemia (normal-sized red cells).';
          likelyCauses = ['Chronic kidney disease', 'Chronic inflammation', 'Acute blood loss', 'Hemolysis', 'Bone marrow disorders'];
          recommendations.push('Check kidney function (creatinine, eGFR), inflammatory markers (CRP), reticulocyte count');
        }
      }

      // Check for iron deficiency anemia pattern
      if (mcv !== undefined && mcv < 80 && rdw !== undefined && rdw > 14.5) {
        interpretation += ' High RDW with low MCV strongly suggests iron deficiency anemia.';
        recommendations.push('Iron deficiency is most likely - start iron supplementation and investigate source of blood loss');
      }
    } else {
      status = 'Normal hemoglobin';
      interpretation = `Hemoglobin is ${hemoglobin} g/dL, normal for ${sex || 'adults'}.`;
      concernLevel = 0;
    }
  }

  // Check hematocrit if hemoglobin not available
  if (hemoglobin === undefined && hematocrit !== undefined) {
    const hctThreshold = sex === 'male' ? 39 : 36;
    hasAnemia = hematocrit < hctThreshold;
    
    if (hasAnemia) {
      status = 'Low hematocrit (anemia)';
      interpretation = `Hematocrit is ${hematocrit}%, low for ${sex || 'adults'}. Check hemoglobin for complete assessment.`;
      concernLevel = 1;
      recommendations.push('Obtain complete CBC with hemoglobin measurement');
    } else {
      status = 'Normal hematocrit';
      interpretation = `Hematocrit is ${hematocrit}%, normal.`;
      concernLevel = 0;
    }
  }

  return { status, interpretation, recommendations, concernLevel, hasAnemia, anemiaType, likelyCauses };
}

/**
 * Assess red blood cell count
 */
function assessRBC(value: number, sex?: 'male' | 'female'): {
  status: string;
  interpretation: string;
  recommendations: string[];
  concernLevel: number;
} {
  const recommendations: string[] = [];
  let status = '';
  let interpretation = '';
  let concernLevel = 0;

  // Normal range: Male 4.5-5.9 × 10^12/L, Female 4.0-5.2 × 10^12/L
  const lowMale = 4.5;
  const highMale = 5.9;
  const lowFemale = 4.0;
  const highFemale = 5.2;

  const low = sex === 'male' ? lowMale : lowFemale;
  const high = sex === 'male' ? highMale : highFemale;

  if (value < low * 0.8) {
    status = 'Low RBC count';
    interpretation = `RBC is ${value} × 10¹²/L, significantly low. Indicates anemia.`;
    recommendations.push('Evaluate cause of anemia (see hemoglobin and MCV assessment)');
    concernLevel = 2;
  } else if (value < low) {
    status = 'Low-normal RBC';
    interpretation = `RBC is ${value} × 10¹²/L, low-normal. Monitor for anemia.`;
    concernLevel = 1;
  } else if (value >= low && value <= high) {
    status = 'Optimal RBC';
    interpretation = `RBC is ${value} × 10¹²/L, optimal for oxygen delivery.`;
    concernLevel = 0;
  } else if (value > high && value <= high * 1.15) {
    status = 'Elevated RBC';
    interpretation = `RBC is ${value} × 10¹²/L, elevated. May indicate polycythemia, dehydration, or high altitude adaptation.`;
    recommendations.push('Check hematocrit and hemoglobin to confirm polycythemia');
    recommendations.push('Consider causes: dehydration, smoking, lung disease, sleep apnea, polycythemia vera');
    concernLevel = 1;
  } else {
    status = 'Significantly elevated RBC (Polycythemia)';
    interpretation = `RBC is ${value} × 10¹²/L, significantly elevated. Warrants evaluation for polycythemia vera or secondary polycythemia.`;
    recommendations.push('Urgent: Evaluate for polycythemia vera (JAK2 mutation test)');
    recommendations.push('Rule out secondary causes: lung disease, sleep apnea, kidney tumor');
    concernLevel = 2;
  }

  return { status, interpretation, recommendations, concernLevel };
}

/**
 * Assess MCV (Mean Corpuscular Volume - red cell size)
 */
function assessMCV(value: number): {
  status: string;
  interpretation: string;
  recommendations: string[];
  concernLevel: number;
} {
  const recommendations: string[] = [];
  let status = '';
  let interpretation = '';
  let concernLevel = 0;

  // Normal range: 80-100 fL
  if (value < 80) {
    status = 'Microcytosis (small red cells)';
    interpretation = `MCV is ${value} fL, low. Red cells are smaller than normal.`;
    recommendations.push('Microcytosis most commonly caused by iron deficiency');
    recommendations.push('Also consider: thalassemia, chronic disease, lead poisoning');
    concernLevel = 1;
  } else if (value >= 80 && value <= 100) {
    status = 'Normal MCV';
    interpretation = `MCV is ${value} fL, normal red cell size.`;
    concernLevel = 0;
  } else if (value > 100 && value <= 110) {
    status = 'Macrocytosis (large red cells)';
    interpretation = `MCV is ${value} fL, elevated. Red cells are larger than normal.`;
    recommendations.push('Macrocytosis commonly caused by vitamin B12 or folate deficiency');
    recommendations.push('Also consider: alcohol use, hypothyroidism, liver disease, medications');
    concernLevel = 1;
  } else {
    status = 'Severe macrocytosis';
    interpretation = `MCV is ${value} fL, significantly elevated. Warrants urgent evaluation.`;
    recommendations.push('Check vitamin B12, folate, and thyroid function immediately');
    recommendations.push('Consider pernicious anemia, severe B12 deficiency, or bone marrow disorders');
    concernLevel = 2;
  }

  return { status, interpretation, recommendations, concernLevel };
}

/**
 * Assess MCH (Mean Corpuscular Hemoglobin)
 */
function assessMCH(value: number): {
  status: string;
  interpretation: string;
  recommendations: string[];
  concernLevel: number;
} {
  const recommendations: string[] = [];
  let status = '';
  let interpretation = '';
  let concernLevel = 0;

  // Normal range: 27-33 pg
  if (value < 27) {
    status = 'Low MCH (hypochromia)';
    interpretation = 'MCH is low, indicating reduced hemoglobin per red cell.';
    concernLevel = 0; // Usually correlates with MCV, not independently actionable
  } else if (value >= 27 && value <= 33) {
    status = 'Normal MCH';
    interpretation = '';
    concernLevel = 0;
  } else {
    status = 'Elevated MCH';
    interpretation = 'MCH is elevated, indicating increased hemoglobin per red cell.';
    concernLevel = 0;
  }

  return { status, interpretation, recommendations, concernLevel };
}

/**
 * Assess MCHC (Mean Corpuscular Hemoglobin Concentration)
 */
function assessMCHC(value: number): {
  status: string;
  interpretation: string;
  recommendations: string[];
  concernLevel: number;
} {
  const recommendations: string[] = [];
  let status = '';
  let interpretation = '';
  let concernLevel = 0;

  // Normal range: 32-36 g/dL
  if (value < 32) {
    status = 'Low MCHC (hypochromia)';
    interpretation = 'MCHC is low, red cells have reduced hemoglobin concentration.';
    concernLevel = 0; // Primarily seen in iron deficiency, already captured by MCV
  } else if (value >= 32 && value <= 36) {
    status = 'Normal MCHC';
    interpretation = '';
    concernLevel = 0;
  } else {
    status = 'Elevated MCHC';
    interpretation = 'MCHC is elevated, may indicate spherocytosis or cold agglutinins.';
    concernLevel = 0;
  }

  return { status, interpretation, recommendations, concernLevel };
}

/**
 * Assess RDW (Red Cell Distribution Width - variation in red cell size)
 */
function assessRDW(value: number): {
  status: string;
  interpretation: string;
  recommendations: string[];
  concernLevel: number;
} {
  const recommendations: string[] = [];
  let status = '';
  let interpretation = '';
  let concernLevel = 0;

  // Normal range: 11.5-14.5%
  if (value >= 11.5 && value <= 14.5) {
    status = 'Normal RDW';
    interpretation = `RDW is ${value}%, indicating uniform red cell size.`;
    concernLevel = 0;
  } else if (value > 14.5 && value <= 16.5) {
    status = 'Elevated RDW';
    interpretation = `RDW is ${value}%, elevated. Red cells vary significantly in size (anisocytosis).`;
    recommendations.push('Elevated RDW with low MCV suggests iron deficiency anemia');
    recommendations.push('Elevated RDW with normal MCV suggests early nutritional deficiency or mixed anemia');
    concernLevel = 1;
  } else {
    status = 'Significantly elevated RDW';
    interpretation = `RDW is ${value}%, significantly elevated. Indicates marked red cell size variation.`;
    recommendations.push('High RDW may indicate severe nutritional deficiency, hemolysis, or mixed anemia types');
    concernLevel = 1;
  }

  return { status, interpretation, recommendations, concernLevel };
}
