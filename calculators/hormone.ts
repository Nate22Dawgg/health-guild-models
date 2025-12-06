/**
 * Hormone Panel Calculators
 * 
 * Evidence-based hormone analysis for longevity and vitality optimization.
 * All reference ranges and interpretations based on clinical endocrinology guidelines.
 * 
 * Key References:
 * - Endocrine Society Clinical Practice Guidelines
 * - American Association of Clinical Endocrinologists (AACE)
 * - Journal of Clinical Endocrinology & Metabolism
 */

export interface HormoneInputs {
  // Sex hormones
  total_testosterone?: number;      // ng/dL
  free_testosterone?: number;       // pg/mL
  estradiol?: number;               // pg/mL
  progesterone?: number;            // ng/mL
  shbg?: number;                    // nmol/L (Sex Hormone Binding Globulin)
  
  // Adrenal hormones
  dhea_s?: number;                  // μg/dL (DHEA-Sulfate)
  cortisol?: number;                // μg/dL (morning)
  
  // Context
  sex?: 'male' | 'female';
  age?: number;
  time_of_day?: 'morning' | 'afternoon' | 'evening';
}

export interface HormoneAssessment {
  overall_status: 'optimal' | 'suboptimal' | 'concerning' | 'unknown';
  severity?: 'mild' | 'moderate' | 'severe';
  interpretation: string;
  recommendations: string[];
  calculated_ratios?: {
    free_testosterone_percent?: number;
    free_androgen_index?: number;
    testosterone_estradiol_ratio?: number;
  };
  markers_analyzed: string[];
  models_ran: Array<{
    name: string;
    result: string;
    evidence_tier: 'A' | 'B' | 'C';
  }>;
}

/**
 * Assess overall hormone panel health
 * Integrates all hormone markers into comprehensive assessment
 */
export function assessHormonePanel(inputs: HormoneInputs): HormoneAssessment {
  const markers: string[] = [];
  const models: Array<{ name: string; result: string; evidence_tier: 'A' | 'B' | 'C' }> = [];
  const recommendations: string[] = [];
  let concernLevel = 0; // 0=optimal, 1=suboptimal, 2=concerning
  
  const interpretations: string[] = [];
  const calculated_ratios: any = {};

  // Validate required context
  if (!inputs.sex) {
    return {
      overall_status: 'unknown',
      interpretation: 'Sex is required for hormone assessment',
      recommendations: ['Provide biological sex for accurate hormone interpretation'],
      markers_analyzed: [],
      models_ran: []
    };
  }

  // Testosterone assessment
  if (inputs.total_testosterone !== undefined) {
    markers.push('total_testosterone');
    const testResult = assessTestosterone(inputs.total_testosterone, inputs.sex, inputs.age);
    models.push({
      name: 'Testosterone Assessment',
      result: testResult.status,
      evidence_tier: 'A'
    });
    interpretations.push(testResult.interpretation);
    recommendations.push(...testResult.recommendations);
    concernLevel = Math.max(concernLevel, testResult.concernLevel);
  }

  // Free testosterone calculation
  if (inputs.total_testosterone && inputs.shbg) {
    markers.push('shbg');
    const freeTestCalc = calculateFreeTestosterone(inputs.total_testosterone, inputs.shbg, inputs.sex);
    calculated_ratios.free_androgen_index = freeTestCalc.fai;
    calculated_ratios.free_testosterone_percent = freeTestCalc.free_percent;
    
    models.push({
      name: 'Free Androgen Index',
      result: freeTestCalc.interpretation,
      evidence_tier: 'B'
    });
    interpretations.push(freeTestCalc.interpretation);
    recommendations.push(...freeTestCalc.recommendations);
    concernLevel = Math.max(concernLevel, freeTestCalc.concernLevel);
  }

  // Estradiol assessment
  if (inputs.estradiol !== undefined) {
    markers.push('estradiol');
    const e2Result = assessEstradiol(inputs.estradiol, inputs.sex, inputs.age);
    models.push({
      name: 'Estradiol Assessment',
      result: e2Result.status,
      evidence_tier: 'A'
    });
    interpretations.push(e2Result.interpretation);
    recommendations.push(...e2Result.recommendations);
    concernLevel = Math.max(concernLevel, e2Result.concernLevel);
  }

  // Testosterone/Estradiol ratio (for men)
  if (inputs.sex === 'male' && inputs.total_testosterone && inputs.estradiol) {
    const teRatio = inputs.total_testosterone / inputs.estradiol;
    calculated_ratios.testosterone_estradiol_ratio = Math.round(teRatio * 10) / 10;
    
    let teInterpretation = '';
    if (teRatio < 10) {
      teInterpretation = `Low T/E2 ratio (${teRatio.toFixed(1)}). Suggests excessive aromatization (testosterone converting to estrogen).`;
      recommendations.push('Consider zinc, DIM, or aromatase inhibitor evaluation with physician');
      concernLevel = Math.max(concernLevel, 1);
    } else if (teRatio >= 10 && teRatio <= 30) {
      teInterpretation = `Optimal T/E2 ratio (${teRatio.toFixed(1)}). Balanced hormone conversion.`;
    } else {
      teInterpretation = `High T/E2 ratio (${teRatio.toFixed(1)}). May indicate low aromatization.`;
    }
    
    models.push({
      name: 'Testosterone/Estradiol Ratio',
      result: teInterpretation,
      evidence_tier: 'B'
    });
    interpretations.push(teInterpretation);
  }

  // DHEA-S assessment
  if (inputs.dhea_s !== undefined) {
    markers.push('dhea_s');
    const dheaResult = assessDHEA(inputs.dhea_s, inputs.sex, inputs.age);
    models.push({
      name: 'DHEA-S Assessment',
      result: dheaResult.status,
      evidence_tier: 'B'
    });
    interpretations.push(dheaResult.interpretation);
    recommendations.push(...dheaResult.recommendations);
    concernLevel = Math.max(concernLevel, dheaResult.concernLevel);
  }

  // Cortisol assessment
  if (inputs.cortisol !== undefined) {
    markers.push('cortisol');
    const cortisolResult = assessCortisol(inputs.cortisol, inputs.time_of_day);
    models.push({
      name: 'Cortisol Assessment',
      result: cortisolResult.status,
      evidence_tier: 'A'
    });
    interpretations.push(cortisolResult.interpretation);
    recommendations.push(...cortisolResult.recommendations);
    concernLevel = Math.max(concernLevel, cortisolResult.concernLevel);
  }

  // Progesterone assessment (mainly for females)
  if (inputs.progesterone !== undefined && inputs.sex === 'female') {
    markers.push('progesterone');
    const progResult = assessProgesterone(inputs.progesterone);
    models.push({
      name: 'Progesterone Assessment',
      result: progResult.status,
      evidence_tier: 'B'
    });
    interpretations.push(progResult.interpretation);
    recommendations.push(...progResult.recommendations);
    concernLevel = Math.max(concernLevel, progResult.concernLevel);
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
    recommendations.push('Consult with an endocrinologist or hormone specialist for comprehensive evaluation');
  }

  return {
    overall_status,
    severity,
    interpretation: interpretations.join(' '),
    recommendations: Array.from(new Set(recommendations)), // Remove duplicates
    calculated_ratios,
    markers_analyzed: markers,
    models_ran: models
  };
}

/**
 * Assess testosterone levels
 */
function assessTestosterone(value: number, sex: 'male' | 'female', age?: number): {
  status: string;
  interpretation: string;
  recommendations: string[];
  concernLevel: number;
} {
  const recommendations: string[] = [];
  let status = '';
  let interpretation = '';
  let concernLevel = 0;

  if (sex === 'male') {
    // Male reference ranges (ng/dL)
    // Optimal for longevity: 500-900
    // Clinical low: <300
    if (value < 300) {
      status = 'Low testosterone (clinical hypogonadism)';
      interpretation = `Total testosterone is ${value} ng/dL, below the clinical threshold of 300 ng/dL. This indicates hypogonadism and warrants medical evaluation.`;
      recommendations.push('Consult endocrinologist for hypogonadism evaluation');
      recommendations.push('Consider causes: testicular dysfunction, pituitary issues, medications, obesity');
      concernLevel = 3;
    } else if (value >= 300 && value < 500) {
      status = 'Low-normal testosterone';
      interpretation = `Total testosterone is ${value} ng/dL, in the low-normal range. While not clinically deficient, this may affect energy, libido, and muscle mass.`;
      recommendations.push('Optimize sleep (7-9 hours), reduce stress, maintain healthy weight');
      recommendations.push('Consider resistance training, adequate dietary fats, vitamin D supplementation');
      concernLevel = 1;
    } else if (value >= 500 && value <= 900) {
      status = 'Optimal testosterone';
      interpretation = `Total testosterone is ${value} ng/dL, in the optimal range for male vitality and longevity.`;
      recommendations.push('Maintain current lifestyle and health practices');
      concernLevel = 0;
    } else {
      status = 'High testosterone';
      interpretation = `Total testosterone is ${value} ng/dL, above optimal range. Consider exogenous testosterone use or rare endocrine conditions.`;
      recommendations.push('If not on testosterone therapy, consult endocrinologist to rule out tumors or PCOS');
      concernLevel = 1;
    }
  } else {
    // Female reference ranges (ng/dL)
    // Optimal: 15-70
    // Clinical high: >80 (PCOS suspect)
    if (value < 15) {
      status = 'Low testosterone';
      interpretation = `Total testosterone is ${value} ng/dL, below normal for females. May affect energy, libido, and muscle tone.`;
      recommendations.push('Consider adrenal or ovarian dysfunction evaluation');
      concernLevel = 1;
    } else if (value >= 15 && value <= 70) {
      status = 'Optimal testosterone';
      interpretation = `Total testosterone is ${value} ng/dL, in the healthy female range.`;
      concernLevel = 0;
    } else if (value > 70 && value <= 100) {
      status = 'Elevated testosterone';
      interpretation = `Total testosterone is ${value} ng/dL, elevated. May indicate PCOS or adrenal hyperplasia.`;
      recommendations.push('Screen for PCOS (irregular periods, acne, hirsutism)');
      recommendations.push('Check DHEA-S, androstenedione, and pelvic ultrasound');
      concernLevel = 2;
    } else {
      status = 'High testosterone';
      interpretation = `Total testosterone is ${value} ng/dL, significantly elevated. Warrants evaluation for PCOS, ovarian tumors, or adrenal disorders.`;
      recommendations.push('Urgent endocrinology consultation for hyperandrogenism workup');
      concernLevel = 3;
    }
  }

  return { status, interpretation, recommendations, concernLevel };
}

/**
 * Calculate Free Androgen Index and free testosterone percentage
 */
function calculateFreeTestosterone(totalTest: number, shbg: number, sex: 'male' | 'female'): {
  fai: number;
  free_percent: number;
  interpretation: string;
  recommendations: string[];
  concernLevel: number;
} {
  // FAI = (Total Testosterone / SHBG) × 100
  const fai = (totalTest / shbg) * 100;
  
  // Approximate free testosterone percentage
  // Clinical formula: depends on SHBG (higher SHBG = lower free %)
  const free_percent = (1 / (1 + (shbg * 0.04))) * 100;
  
  const recommendations: string[] = [];
  let interpretation = '';
  let concernLevel = 0;

  if (sex === 'male') {
    if (fai < 30) {
      interpretation = `Free Androgen Index is ${fai.toFixed(1)}, low. High SHBG is binding testosterone, reducing bioavailable hormone.`;
      recommendations.push('High SHBG can be caused by hyperthyroidism, liver disease, or excessive alcohol');
      recommendations.push('Consider reducing alcohol, optimizing thyroid, and resistance training');
      concernLevel = 1;
    } else if (fai >= 30 && fai <= 100) {
      interpretation = `Free Androgen Index is ${fai.toFixed(1)}, optimal. Good balance of free testosterone.`;
      concernLevel = 0;
    } else {
      interpretation = `Free Androgen Index is ${fai.toFixed(1)}, elevated. Low SHBG may indicate insulin resistance or metabolic syndrome.`;
      recommendations.push('Evaluate for metabolic syndrome, insulin resistance, and liver health');
      concernLevel = 1;
    }
  } else {
    if (fai < 1) {
      interpretation = `Free Androgen Index is ${fai.toFixed(1)}, low for females.`;
      concernLevel = 0;
    } else if (fai >= 1 && fai <= 5) {
      interpretation = `Free Androgen Index is ${fai.toFixed(1)}, normal for females.`;
      concernLevel = 0;
    } else {
      interpretation = `Free Androgen Index is ${fai.toFixed(1)}, elevated. May indicate PCOS or hyperandrogenism.`;
      recommendations.push('Elevated FAI in women suggests PCOS - evaluate for insulin resistance and ovarian dysfunction');
      concernLevel = 2;
    }
  }

  return { fai, free_percent, interpretation, recommendations, concernLevel };
}

/**
 * Assess estradiol levels
 */
function assessEstradiol(value: number, sex: 'male' | 'female', age?: number): {
  status: string;
  interpretation: string;
  recommendations: string[];
  concernLevel: number;
} {
  const recommendations: string[] = [];
  let status = '';
  let interpretation = '';
  let concernLevel = 0;

  if (sex === 'male') {
    // Male reference: 10-40 pg/mL (optimal 20-30)
    if (value < 10) {
      status = 'Low estradiol';
      interpretation = `Estradiol is ${value} pg/mL, low for men. May affect bone health, libido, and cardiovascular function.`;
      recommendations.push('Low estradiol in men can impair bone density and joint health');
      concernLevel = 1;
    } else if (value >= 10 && value <= 40) {
      status = 'Optimal estradiol';
      interpretation = `Estradiol is ${value} pg/mL, optimal for male health.`;
      concernLevel = 0;
    } else if (value > 40 && value <= 60) {
      status = 'Elevated estradiol';
      interpretation = `Estradiol is ${value} pg/mL, elevated. May cause gynecomastia, water retention, and reduce testosterone effectiveness.`;
      recommendations.push('Consider reducing body fat, limiting alcohol, and optimizing zinc intake');
      concernLevel = 1;
    } else {
      status = 'High estradiol';
      interpretation = `Estradiol is ${value} pg/mL, significantly elevated. Warrants evaluation for excessive aromatization or exogenous estrogen exposure.`;
      recommendations.push('Consult endocrinologist for aromatase inhibitor consideration');
      concernLevel = 2;
    }
  } else {
    // Female reference varies by cycle phase
    // Follicular: 30-100 pg/mL, Ovulation: 100-400 pg/mL, Luteal: 50-200 pg/mL, Postmenopausal: <30 pg/mL
    if (value < 20) {
      status = 'Low estradiol';
      interpretation = `Estradiol is ${value} pg/mL, low. May indicate menopause, ovarian insufficiency, or hypogonadism.`;
      recommendations.push('If premenopausal, evaluate for premature ovarian failure or pituitary dysfunction');
      recommendations.push('If postmenopausal, consider symptoms and hormone replacement therapy discussion');
      concernLevel = 1;
    } else if (value >= 20 && value <= 400) {
      status = 'Normal estradiol (cycle-dependent)';
      interpretation = `Estradiol is ${value} pg/mL. Normal range varies by menstrual cycle phase or menopausal status.`;
      concernLevel = 0;
    } else {
      status = 'Elevated estradiol';
      interpretation = `Estradiol is ${value} pg/mL, elevated. May indicate estrogen dominance, ovarian cysts, or tumors.`;
      recommendations.push('Evaluate for ovarian cysts, fibroids, or estrogen-secreting tumors');
      concernLevel = 2;
    }
  }

  return { status, interpretation, recommendations, concernLevel };
}

/**
 * Assess DHEA-S (adrenal androgen, longevity marker)
 */
function assessDHEA(value: number, sex: 'male' | 'female', age?: number): {
  status: string;
  interpretation: string;
  recommendations: string[];
  concernLevel: number;
} {
  const recommendations: string[] = [];
  let status = '';
  let interpretation = '';
  let concernLevel = 0;

  // DHEA-S declines with age
  // Age 20-30: 280-640 μg/dL (males), 65-380 μg/dL (females)
  // Age 40-50: 120-520 μg/dL (males), 45-270 μg/dL (females)
  // Age 60+: 40-290 μg/dL (males), 20-130 μg/dL (females)

  let expectedMin = 100;
  let expectedMax = 500;

  if (age) {
    if (sex === 'male') {
      if (age < 40) {
        expectedMin = 280; expectedMax = 640;
      } else if (age < 60) {
        expectedMin = 120; expectedMax = 520;
      } else {
        expectedMin = 40; expectedMax = 290;
      }
    } else {
      if (age < 40) {
        expectedMin = 65; expectedMax = 380;
      } else if (age < 60) {
        expectedMin = 45; expectedMax = 270;
      } else {
        expectedMin = 20; expectedMax = 130;
      }
    }
  }

  if (value < expectedMin * 0.5) {
    status = 'Very low DHEA-S';
    interpretation = `DHEA-S is ${value} μg/dL, significantly below age-expected range. May indicate adrenal insufficiency or accelerated aging.`;
    recommendations.push('Evaluate for adrenal insufficiency (Addison\'s disease) with ACTH stimulation test');
    recommendations.push('Consider DHEA supplementation (25-50 mg daily) under physician guidance');
    concernLevel = 2;
  } else if (value < expectedMin) {
    status = 'Low DHEA-S';
    interpretation = `DHEA-S is ${value} μg/dL, below optimal for age. May affect energy, immunity, and longevity.`;
    recommendations.push('Optimize sleep, reduce chronic stress, and consider DHEA supplementation');
    concernLevel = 1;
  } else if (value >= expectedMin && value <= expectedMax) {
    status = 'Optimal DHEA-S';
    interpretation = `DHEA-S is ${value} μg/dL, optimal for age. Good adrenal reserve and aging biomarker.`;
    concernLevel = 0;
  } else {
    status = 'Elevated DHEA-S';
    interpretation = `DHEA-S is ${value} μg/dL, above age-expected range. May indicate adrenal hyperplasia or supplementation.`;
    recommendations.push('If not supplementing DHEA, evaluate for congenital adrenal hyperplasia or adrenal tumor');
    concernLevel = 1;
  }

  return { status, interpretation, recommendations, concernLevel };
}

/**
 * Assess cortisol (stress hormone, follows diurnal rhythm)
 */
function assessCortisol(value: number, timeOfDay?: 'morning' | 'afternoon' | 'evening'): {
  status: string;
  interpretation: string;
  recommendations: string[];
  concernLevel: number;
} {
  const recommendations: string[] = [];
  let status = '';
  let interpretation = '';
  let concernLevel = 0;

  // Morning cortisol should be highest (10-20 μg/dL)
  // Evening cortisol should be low (<5 μg/dL)

  if (timeOfDay === 'morning' || !timeOfDay) {
    if (value < 5) {
      status = 'Low morning cortisol';
      interpretation = `Morning cortisol is ${value} μg/dL, low. May indicate adrenal insufficiency or HPA axis dysfunction.`;
      recommendations.push('Evaluate for adrenal insufficiency with ACTH stimulation test');
      recommendations.push('Consider chronic stress, burnout, or Addison\'s disease');
      concernLevel = 2;
    } else if (value >= 5 && value <= 10) {
      status = 'Low-normal morning cortisol';
      interpretation = `Morning cortisol is ${value} μg/dL, low-normal. May suggest suboptimal HPA axis function.`;
      recommendations.push('Optimize sleep quality, manage chronic stress, and support adrenal health');
      concernLevel = 1;
    } else if (value > 10 && value <= 20) {
      status = 'Optimal morning cortisol';
      interpretation = `Morning cortisol is ${value} μg/dL, optimal. Healthy HPA axis and stress response.`;
      concernLevel = 0;
    } else {
      status = 'Elevated morning cortisol';
      interpretation = `Morning cortisol is ${value} μg/dL, elevated. May indicate chronic stress, Cushing's syndrome, or anxiety.`;
      recommendations.push('Evaluate for Cushing\'s syndrome if persistently elevated');
      recommendations.push('Implement stress reduction: meditation, exercise, adequate sleep');
      concernLevel = 1;
    }
  } else if (timeOfDay === 'evening') {
    if (value < 3) {
      status = 'Optimal evening cortisol';
      interpretation = `Evening cortisol is ${value} μg/dL, optimal. Healthy circadian rhythm.`;
      concernLevel = 0;
    } else if (value >= 3 && value <= 7) {
      status = 'Elevated evening cortisol';
      interpretation = `Evening cortisol is ${value} μg/dL, elevated. May indicate disrupted circadian rhythm or chronic stress.`;
      recommendations.push('Improve sleep hygiene, reduce evening stress, and avoid late-night stimulants');
      concernLevel = 1;
    } else {
      status = 'High evening cortisol';
      interpretation = `Evening cortisol is ${value} μg/dL, significantly elevated. Disrupted HPA axis rhythm.`;
      recommendations.push('Evaluate for Cushing\'s syndrome or severe chronic stress');
      concernLevel = 2;
    }
  }

  return { status, interpretation, recommendations, concernLevel };
}

/**
 * Assess progesterone (mainly relevant for females)
 */
function assessProgesterone(value: number): {
  status: string;
  interpretation: string;
  recommendations: string[];
  concernLevel: number;
} {
  const recommendations: string[] = [];
  let status = '';
  let interpretation = '';
  let concernLevel = 0;

  // Progesterone varies by cycle phase
  // Follicular phase: <1 ng/mL
  // Luteal phase: 5-20 ng/mL (confirms ovulation)
  // Postmenopausal: <1 ng/mL

  if (value < 1) {
    status = 'Low progesterone';
    interpretation = `Progesterone is ${value} ng/mL. If measured in luteal phase, may indicate anovulation or luteal phase defect.`;
    recommendations.push('If trying to conceive, consult reproductive endocrinologist');
    recommendations.push('Confirm ovulation with basal body temperature or ovulation predictor kits');
    concernLevel = 1;
  } else if (value >= 5 && value <= 20) {
    status = 'Normal luteal phase progesterone';
    interpretation = `Progesterone is ${value} ng/mL, confirming ovulation. Healthy luteal phase.`;
    concernLevel = 0;
  } else if (value > 20) {
    status = 'Elevated progesterone';
    interpretation = `Progesterone is ${value} ng/mL, elevated. May indicate pregnancy, ovarian cyst, or supplementation.`;
    recommendations.push('Rule out pregnancy if applicable');
    concernLevel = 0;
  } else {
    status = 'Progesterone measured (cycle phase unclear)';
    interpretation = `Progesterone is ${value} ng/mL. Interpretation depends on cycle phase timing.`;
    concernLevel = 0;
  }

  return { status, interpretation, recommendations, concernLevel };
}
