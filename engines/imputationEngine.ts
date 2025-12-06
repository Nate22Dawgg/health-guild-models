/**
 * IMPUTATION ENGINE
 * Intelligently fills missing biomarkers using 30 atomic models
 * Week 2: Core intelligence layer for Health Guild MCP
 */

import { LabSnapshot, UserProfile } from '../types/health-data';
import { PredictionResult } from '../models/deterministic/lipidModels';

// Import all atomic models
import {
  calculateApoB,
  calculateNonHDL,
  calculateSDLDLPattern,
  calculateTCHDLRatio,
  calculateTGHDLRatio,
  calculateHOMAIR,
  estimateHOMAIR,
  estimateHbA1c,
  calculateEGFR_CKD_EPI,
  calculateBUNCreatinineRatio,
  calculateASTALTRatio,
  calculateFIB4,
  calculateNLR,
  calculatePLR,
  calculateSII,
  categorizeCRPRisk,
  calculateFAI,
  calculateTtoERatio,
  estimateFreeTesto,
  calculateDHEASScore,
  calculateAIP,
  calculateCastelliRiskIndex
} from '../models/deterministic';

export interface ImputedBiomarker {
  marker_name: string;
  predicted_value: number;
  unit: string;
  confidence: number;
  category?: string;
  interpretation: string;
  evidence: {
    source: string;
    doi?: string;
    r_squared: number;
  };
  ci_95?: [number, number];
  model_used: string;
  inputs_used: string[];
  missing_inputs?: string[];
  actionable?: boolean;  // Can user get this test easily?
}

export interface ImputationReport {
  total_imputed: number;
  high_confidence: number;    // R² > 0.70
  moderate_confidence: number; // R² 0.50-0.70
  low_confidence: number;      // R² < 0.50
  imputed_markers: ImputedBiomarker[];
  skipped_markers: {
    marker: string;
    reason: string;
  }[];
}

/**
 * Core Imputation Engine
 * Analyzes available data and runs all applicable models
 */
export function imputeMissingBiomarkers(
  latest_labs: LabSnapshot,
  user_profile: UserProfile,
  wearable_data?: {
    sleep_duration_avg?: number;
    sleep_efficiency_avg?: number;
    sleep_duration_sd?: number;
    steps_avg?: number;
    steps_sd?: number;
    hrv_avg?: number;
    hrv_sd?: number;
    resting_hr_avg?: number;
    activity_variability?: number;
    screen_time_min?: number;
  }
): ImputationReport {
  const imputed: ImputedBiomarker[] = [];
  const skipped: { marker: string; reason: string }[] = [];
  
  // ============================================================================
  // LIPID MODELS (5 models)
  // ============================================================================
  
  // apoB (if missing, but have TC, HDL, TG)
  if (!latest_labs.apoB && latest_labs.totalCholesterol && latest_labs.HDL && latest_labs.triglycerides) {
    try {
      const result = calculateApoB(latest_labs.totalCholesterol, latest_labs.HDL, latest_labs.triglycerides);
      imputed.push({
        marker_name: 'Apolipoprotein B (apoB)',
        predicted_value: result.value,
        unit: result.unit,
        confidence: result.confidence,
        category: result.category,
        interpretation: result.interpretation || '',
        evidence: result.evidence,
        ci_95: result.ci_95,
        model_used: 'calculate_apob',
        inputs_used: ['Total Cholesterol', 'HDL', 'Triglycerides'],
        actionable: true  // Easy $30-50 test
      });
    } catch (error) {
      skipped.push({ marker: 'apoB', reason: `Calculation error: ${error}` });
    }
  } else if (!latest_labs.apoB) {
    skipped.push({ marker: 'apoB', reason: 'Missing required inputs (TC, HDL, TG)' });
  }
  
  // Non-HDL Cholesterol (always calculable if have TC and HDL)
  if (!latest_labs.nonHDLCholesterol && latest_labs.totalCholesterol && latest_labs.HDL) {
    try {
      const result = calculateNonHDL(latest_labs.totalCholesterol, latest_labs.HDL);
      imputed.push({
        marker_name: 'Non-HDL Cholesterol',
        predicted_value: result.value,
        unit: result.unit,
        confidence: result.confidence,
        category: result.category,
        interpretation: result.interpretation || '',
        evidence: result.evidence,
        model_used: 'calculate_non_hdl',
        inputs_used: ['Total Cholesterol', 'HDL'],
        actionable: false  // Calculated value, not a test
      });
    } catch (error) {
      skipped.push({ marker: 'Non-HDL', reason: `Calculation error: ${error}` });
    }
  }
  
  // sdLDL Pattern (if have TG and HDL)
  if (latest_labs.triglycerides && latest_labs.HDL) {
    try {
      const result = calculateSDLDLPattern(latest_labs.triglycerides, latest_labs.HDL);
      imputed.push({
        marker_name: 'LDL Particle Pattern (A vs B)',
        predicted_value: result.value,
        unit: result.unit,
        confidence: result.confidence,
        category: result.category,
        interpretation: result.interpretation || '',
        evidence: result.evidence,
        model_used: 'calculate_sdldl_pattern',
        inputs_used: ['Triglycerides', 'HDL'],
        actionable: true  // NMR LipoProfile test ($100-200)
      });
    } catch (error) {
      skipped.push({ marker: 'sdLDL Pattern', reason: `Calculation error: ${error}` });
    }
  }
  
  // TG/HDL Ratio (insulin resistance marker)
  if (latest_labs.triglycerides && latest_labs.HDL) {
    try {
      const result = calculateTGHDLRatio(latest_labs.triglycerides, latest_labs.HDL);
      imputed.push({
        marker_name: 'TG/HDL Ratio (Insulin Resistance Marker)',
        predicted_value: result.value,
        unit: result.unit,
        confidence: result.confidence,
        category: result.category,
        interpretation: result.interpretation || '',
        evidence: result.evidence,
        model_used: 'calculate_tg_hdl_ratio',
        inputs_used: ['Triglycerides', 'HDL'],
        actionable: false  // Calculated ratio
      });
    } catch (error) {
      skipped.push({ marker: 'TG/HDL Ratio', reason: `Calculation error: ${error}` });
    }
  }
  
  // TC/HDL Ratio (CVD risk marker)
  if (latest_labs.totalCholesterol && latest_labs.HDL) {
    try {
      const result = calculateTCHDLRatio(latest_labs.totalCholesterol, latest_labs.HDL);
      imputed.push({
        marker_name: 'TC/HDL Ratio (CVD Risk)',
        predicted_value: result.value,
        unit: result.unit,
        confidence: result.confidence,
        category: result.category,
        interpretation: result.interpretation || '',
        evidence: result.evidence,
        model_used: 'calculate_tc_hdl_ratio',
        inputs_used: ['Total Cholesterol', 'HDL'],
        actionable: false
      });
    } catch (error) {
      skipped.push({ marker: 'TC/HDL Ratio', reason: `Calculation error: ${error}` });
    }
  }
  
  // ============================================================================
  // METABOLIC MODELS (3 models)
  // ============================================================================
  
  // HOMA-IR (if have fasting glucose and insulin)
  if (!latest_labs.HOMA_IR && latest_labs.fastingGlucose && latest_labs.fastingInsulin) {
    try {
      const result = calculateHOMAIR(latest_labs.fastingGlucose, latest_labs.fastingInsulin);
      imputed.push({
        marker_name: 'HOMA-IR (Insulin Resistance Index)',
        predicted_value: result.value,
        unit: result.unit,
        confidence: result.confidence,
        category: result.category,
        interpretation: result.interpretation || '',
        evidence: result.evidence,
        model_used: 'calculate_homa_ir',
        inputs_used: ['Fasting Glucose', 'Fasting Insulin'],
        actionable: false
      });
    } catch (error) {
      skipped.push({ marker: 'HOMA-IR', reason: `Calculation error: ${error}` });
    }
  }
  
  // HOMA-IR Estimate (if no insulin, but have glucose + anthropometrics + lipids)
  if (!latest_labs.HOMA_IR && !latest_labs.fastingInsulin && 
      latest_labs.fastingGlucose && user_profile.waist_circumference && 
      user_profile.bmi && latest_labs.triglycerides && latest_labs.HDL) {
    try {
      const result = estimateHOMAIR(
        latest_labs.fastingGlucose,
        user_profile.waist_circumference,
        user_profile.bmi,
        latest_labs.triglycerides,
        latest_labs.HDL
      );
      imputed.push({
        marker_name: 'HOMA-IR (Estimated)',
        predicted_value: result.value,
        unit: result.unit,
        confidence: result.confidence,
        category: result.category,
        interpretation: result.interpretation || '',
        evidence: result.evidence,
        ci_95: result.ci_95,
        model_used: 'estimate_homa_ir_from_lipids',
        inputs_used: ['Fasting Glucose', 'Waist', 'BMI', 'Triglycerides', 'HDL'],
        actionable: true  // Get fasting insulin test ($30-50)
      });
    } catch (error) {
      skipped.push({ marker: 'HOMA-IR Estimate', reason: `Calculation error: ${error}` });
    }
  }
  
  // HbA1c Estimate (if no HbA1c, but have fasting glucose)
  if (!latest_labs.HbA1c && latest_labs.fastingGlucose) {
    try {
      const result = estimateHbA1c(latest_labs.fastingGlucose);
      imputed.push({
        marker_name: 'HbA1c (Estimated)',
        predicted_value: result.value,
        unit: result.unit,
        confidence: result.confidence,
        category: result.category,
        interpretation: result.interpretation || '',
        evidence: result.evidence,
        ci_95: result.ci_95,
        model_used: 'estimate_hba1c_from_glucose',
        inputs_used: ['Fasting Glucose'],
        actionable: true  // Get HbA1c test ($20-30, no fasting)
      });
    } catch (error) {
      skipped.push({ marker: 'HbA1c Estimate', reason: `Calculation error: ${error}` });
    }
  }
  
  // ============================================================================
  // KIDNEY MODELS (2 models)
  // ============================================================================
  
  // eGFR (if have creatinine, age, sex)
  if (!latest_labs.eGFR && latest_labs.creatinine && user_profile.age && user_profile.sex) {
    try {
      const result = calculateEGFR_CKD_EPI(
        latest_labs.creatinine,
        user_profile.age,
        user_profile.sex as 'male' | 'female'
      );
      imputed.push({
        marker_name: 'eGFR (Kidney Function)',
        predicted_value: result.value,
        unit: result.unit,
        confidence: result.confidence,
        category: result.category,
        interpretation: result.interpretation || '',
        evidence: result.evidence,
        model_used: 'calculate_egfr_ckd_epi',
        inputs_used: ['Creatinine', 'Age', 'Sex'],
        actionable: false  // Calculated from creatinine
      });
    } catch (error) {
      skipped.push({ marker: 'eGFR', reason: `Calculation error: ${error}` });
    }
  }
  
  // BUN/Creatinine Ratio (if have both)
  if (latest_labs.BUN && latest_labs.creatinine) {
    try {
      const result = calculateBUNCreatinineRatio(latest_labs.BUN, latest_labs.creatinine);
      imputed.push({
        marker_name: 'BUN/Creatinine Ratio',
        predicted_value: result.value,
        unit: result.unit,
        confidence: result.confidence,
        category: result.category,
        interpretation: result.interpretation || '',
        evidence: result.evidence,
        model_used: 'calculate_bun_creatinine_ratio',
        inputs_used: ['BUN', 'Creatinine'],
        actionable: false
      });
    } catch (error) {
      skipped.push({ marker: 'BUN/Cr Ratio', reason: `Calculation error: ${error}` });
    }
  }
  
  // ============================================================================
  // LIVER MODELS (2 models)
  // ============================================================================
  
  // AST/ALT Ratio
  if (latest_labs.AST && latest_labs.ALT) {
    try {
      const result = calculateASTALTRatio(latest_labs.AST, latest_labs.ALT);
      imputed.push({
        marker_name: 'AST/ALT Ratio (Liver Pattern)',
        predicted_value: result.value,
        unit: result.unit,
        confidence: result.confidence,
        category: result.category,
        interpretation: result.interpretation || '',
        evidence: result.evidence,
        model_used: 'calculate_ast_alt_ratio',
        inputs_used: ['AST', 'ALT'],
        actionable: false
      });
    } catch (error) {
      skipped.push({ marker: 'AST/ALT Ratio', reason: `Calculation error: ${error}` });
    }
  }
  
  // FIB-4 Score (liver fibrosis)
  if (latest_labs.AST && latest_labs.ALT && latest_labs.platelets && user_profile.age) {
    try {
      const result = calculateFIB4(user_profile.age, latest_labs.AST, latest_labs.ALT, latest_labs.platelets);
      imputed.push({
        marker_name: 'FIB-4 Score (Liver Fibrosis)',
        predicted_value: result.value,
        unit: result.unit,
        confidence: result.confidence,
        category: result.category,
        interpretation: result.interpretation || '',
        evidence: result.evidence,
        model_used: 'calculate_fib4',
        inputs_used: ['Age', 'AST', 'ALT', 'Platelets'],
        actionable: true  // FibroScan test ($200-500)
      });
    } catch (error) {
      skipped.push({ marker: 'FIB-4', reason: `Calculation error: ${error}` });
    }
  }
  
  // ============================================================================
  // INFLAMMATORY MODELS (4 models)
  // ============================================================================
  
  // NLR (Neutrophil-to-Lymphocyte Ratio)
  if (latest_labs.neutrophils && latest_labs.lymphocytes) {
    try {
      const result = calculateNLR(latest_labs.neutrophils, latest_labs.lymphocytes);
      imputed.push({
        marker_name: 'NLR (Neutrophil-to-Lymphocyte Ratio)',
        predicted_value: result.value,
        unit: result.unit,
        confidence: result.confidence,
        category: result.category,
        interpretation: result.interpretation || '',
        evidence: result.evidence,
        model_used: 'calculate_nlr',
        inputs_used: ['Neutrophils', 'Lymphocytes'],
        actionable: false
      });
    } catch (error) {
      skipped.push({ marker: 'NLR', reason: `Calculation error: ${error}` });
    }
  }
  
  // PLR (Platelet-to-Lymphocyte Ratio)
  if (latest_labs.platelets && latest_labs.lymphocytes) {
    try {
      const result = calculatePLR(latest_labs.platelets, latest_labs.lymphocytes);
      imputed.push({
        marker_name: 'PLR (Platelet-to-Lymphocyte Ratio)',
        predicted_value: result.value,
        unit: result.unit,
        confidence: result.confidence,
        category: result.category,
        interpretation: result.interpretation || '',
        evidence: result.evidence,
        model_used: 'calculate_plr',
        inputs_used: ['Platelets', 'Lymphocytes'],
        actionable: false
      });
    } catch (error) {
      skipped.push({ marker: 'PLR', reason: `Calculation error: ${error}` });
    }
  }
  
  // SII (Systemic Immune-Inflammation Index)
  if (latest_labs.platelets && latest_labs.neutrophils && latest_labs.lymphocytes) {
    try {
      const result = calculateSII(latest_labs.platelets, latest_labs.neutrophils, latest_labs.lymphocytes);
      imputed.push({
        marker_name: 'SII (Systemic Immune-Inflammation Index)',
        predicted_value: result.value,
        unit: result.unit,
        confidence: result.confidence,
        category: result.category,
        interpretation: result.interpretation || '',
        evidence: result.evidence,
        model_used: 'calculate_sii',
        inputs_used: ['Platelets', 'Neutrophils', 'Lymphocytes'],
        actionable: false
      });
    } catch (error) {
      skipped.push({ marker: 'SII', reason: `Calculation error: ${error}` });
    }
  }
  
  // CRP-based CVD risk (if have hsCRP)
  if (latest_labs.CRP) {
    try {
      const result = categorizeCRPRisk(latest_labs.CRP);
      imputed.push({
        marker_name: 'CRP-Based CVD Risk Category',
        predicted_value: result.value,
        unit: result.unit,
        confidence: result.confidence,
        category: result.category,
        interpretation: result.interpretation || '',
        evidence: result.evidence,
        model_used: 'categorize_crp_risk',
        inputs_used: ['hsCRP'],
        actionable: false
      });
    } catch (error) {
      skipped.push({ marker: 'CRP Risk', reason: `Calculation error: ${error}` });
    }
  }
  
  // ============================================================================
  // CARDIOVASCULAR MODELS (2 derived indices)
  // ============================================================================
  
  // AIP (Atherogenic Index of Plasma)
  if (latest_labs.triglycerides && latest_labs.HDL) {
    try {
      const result = calculateAIP(latest_labs.triglycerides, latest_labs.HDL);
      imputed.push({
        marker_name: 'AIP (Atherogenic Index of Plasma)',
        predicted_value: result.value,
        unit: result.unit,
        confidence: result.confidence,
        category: result.category,
        interpretation: result.interpretation || '',
        evidence: result.evidence,
        model_used: 'calculate_aip',
        inputs_used: ['Triglycerides', 'HDL'],
        actionable: false
      });
    } catch (error) {
      skipped.push({ marker: 'AIP', reason: `Calculation error: ${error}` });
    }
  }
  
  // Castelli Risk Index
  if (latest_labs.totalCholesterol && latest_labs.HDL) {
    try {
      const result = calculateCastelliRiskIndex(latest_labs.totalCholesterol, latest_labs.HDL, latest_labs.LDL);
      imputed.push({
        marker_name: 'Castelli Risk Index (CRI)',
        predicted_value: result.value,
        unit: result.unit,
        confidence: result.confidence,
        category: result.category,
        interpretation: result.interpretation || '',
        evidence: result.evidence,
        model_used: 'calculate_castelli_risk_index',
        inputs_used: ['Total Cholesterol', 'HDL', 'LDL (optional)'],
        actionable: false
      });
    } catch (error) {
      skipped.push({ marker: 'Castelli Index', reason: `Calculation error: ${error}` });
    }
  }
  
  // ============================================================================
  // AGGREGATE RESULTS
  // ============================================================================
  
  const high_confidence = imputed.filter(m => m.confidence >= 0.70).length;
  const moderate_confidence = imputed.filter(m => m.confidence >= 0.50 && m.confidence < 0.70).length;
  const low_confidence = imputed.filter(m => m.confidence < 0.50).length;
  
  return {
    total_imputed: imputed.length,
    high_confidence,
    moderate_confidence,
    low_confidence,
    imputed_markers: imputed,
    skipped_markers: skipped
  };
}
