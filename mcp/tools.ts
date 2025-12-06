/**
 * MCP Tool Definitions
 * Defines the tools exposed via MCP protocol
 */

import { MCPTool, MCPToolResult } from './types'
import { 
  computeRiskScoresWithMetadata, 
  UserProfile as CalculatorUserProfile, 
  Labs 
} from '../calculators'
import { UserProfile, LabSnapshot } from '../types/health-data'
import { analyzeTrends } from '../engines/trendAnalysis'
import { calculateDomainScores } from '../engines/domainScoring'
import { calculateHealthIndex, getHealthIndexBadge } from '../engines/healthIndex'
import { 
  analyzeDomainCoverage, 
  analyzeModelCoverage, 
  suggestAdditionalData 
} from '../engines/coverageAnalysis'
import { calculateDerivedRatios, analyzeMarkerUtilization } from '../engines/derivedRatios'
import {
  assessThyroidFunction,
  calculateT3ReverseT3Ratio,
  calculateT3T4Ratio,
  assessHashimotosRisk
} from '../calculators/thyroid'
import { assessHormonePanel, HormoneInputs } from '../calculators/hormone'
import { assessCBC, CBCInputs } from '../calculators/cbc'
import { assessAdvancedLipids, AdvancedLipidsInputs } from '../calculators/advanced-lipids'
import { generateHealthStory } from '../engines/healthStoryFlow'
import { HealthTimeline } from '../types/health-data'
import { analyzeCorrelations } from '../engines/correlationAnalysis'
import { queryTimelineData } from '../engines/timelineQuery'
import { exportTimeline } from '../engines/timelineExport'

export const HEALTH_GUILD_TOOLS: MCPTool[] = [
  {
    name: 'calculate_risk_scores',
    description: 'Calculate comprehensive health risk scores including cardiovascular (ASCVD), liver (FIB-4, NAFLD), kidney (eGFR, CKD stage), and metabolic (HOMA-IR) assessments. Returns risk scores with categories, clinical interpretations, AND transparent metadata showing which models ran successfully, which were skipped, and why.',
    inputSchema: {
      type: 'object',
      properties: {
        user_profile: {
          type: 'object',
          description: 'Patient demographic and clinical profile',
          properties: {
            age: { type: 'number', description: 'Age in years (20-79 for ASCVD, ≥18 for others)' },
            sex: { type: 'string', enum: ['male', 'female'], description: 'Biological sex' },
            race: { type: 'string', enum: ['white', 'black', 'african american', 'other'], description: 'Race (for ASCVD calculation)' },
            smoker: { type: 'boolean', description: 'Current smoker status' },
            diabetic: { type: 'boolean', description: 'Diabetes diagnosis' },
            onBPMeds: { type: 'boolean', description: 'On blood pressure medication' },
            bmi: { type: 'number', description: 'Body Mass Index (required for NAFLD score)' }
          },
          required: ['age', 'sex']
        },
        labs: {
          type: 'object',
          description: 'Laboratory test results',
          properties: {
            totalChol: { type: 'number', description: 'Total cholesterol (mg/dL)' },
            hdl: { type: 'number', description: 'HDL cholesterol (mg/dL)' },
            sbp: { type: 'number', description: 'Systolic blood pressure (mmHg)' },
            ast: { type: 'number', description: 'Aspartate aminotransferase (U/L)' },
            alt: { type: 'number', description: 'Alanine aminotransferase (U/L)' },
            platelets: { type: 'number', description: 'Platelet count (×10⁹/L)' },
            creatinine: { type: 'number', description: 'Serum creatinine (mg/dL)' },
            fastingGlucose: { type: 'number', description: 'Fasting glucose (mg/dL)' },
            fastingInsulin: { type: 'number', description: 'Fasting insulin (μU/mL, optional for HOMA-IR)' },
            albumin: { type: 'number', description: 'Serum albumin (g/dL, optional for NAFLD)' }
          },
          required: ['totalChol', 'hdl', 'sbp', 'ast', 'alt', 'platelets', 'creatinine', 'fastingGlucose']
        }
      },
      required: ['user_profile', 'labs']
    }
  },
  {
    name: 'analyze_lab_history',
    description: 'Analyze longitudinal health data across multiple time points to detect trends, calculate domain-specific health scores (metabolic, lipid, liver, kidney, inflammation, nutrient), compute an overall health index (0-100), and provide transparent metadata about models used and data coverage. Transforms point-in-time labs into a comprehensive health trajectory analysis.',
    inputSchema: {
      type: 'object',
      properties: {
        user_profile: {
          type: 'object',
          description: 'Patient demographic and clinical profile',
          properties: {
            age: { type: 'number', description: 'Current age in years' },
            sex: { type: 'string', enum: ['male', 'female', 'other', 'unknown'], description: 'Biological sex' },
            race: { type: 'string', description: 'Race/ethnicity (optional)' },
            height_cm: { type: 'number', description: 'Height in centimeters (optional)' },
            weight_kg: { type: 'number', description: 'Weight in kilograms (optional)' },
            smoker: { type: 'boolean', description: 'Current smoker status (optional)' },
            diabetic: { type: 'boolean', description: 'Diabetes diagnosis (optional)' },
            on_bp_meds: { type: 'boolean', description: 'On blood pressure medication (optional)' }
          },
          required: ['age', 'sex']
        },
        lab_history: {
          type: 'array',
          description: 'Array of lab snapshots over time (min 1, recommend 2+ for trends)',
          items: {
            type: 'object',
            properties: {
              date: { type: 'string', description: 'ISO date (YYYY-MM-DD) of lab draw' },
              context: { type: 'string', description: 'Optional context (e.g., "Annual physical 2024")' },
              labs: {
                type: 'object',
                description: 'Lab values as key-value pairs (e.g., { "glucose": 95, "total_chol": 200 })',
                additionalProperties: { type: 'number' }
              }
            },
            required: ['date', 'labs']
          },
          minItems: 1
        }
      },
      required: ['user_profile', 'lab_history']
    }
  },
  {
    name: 'health_coverage_map',
    description: 'Analyze current data coverage to show which health domains and clinical models are fully supported, partially supported, or blocked by missing data. Provides transparent breakdown of what models can run with available data, what data is missing, and suggests additional tests to unlock more insights. Helps users understand data completeness and prioritize future lab work.',
    inputSchema: {
      type: 'object',
      properties: {
        user_profile: {
          type: 'object',
          description: 'Patient demographic and clinical profile',
          properties: {
            age: { type: 'number', description: 'Current age in years' },
            sex: { type: 'string', enum: ['male', 'female', 'other', 'unknown'], description: 'Biological sex' },
            race: { type: 'string', description: 'Race/ethnicity (optional)' },
            bmi: { type: 'number', description: 'Body Mass Index (optional)' },
            smoker: { type: 'boolean', description: 'Current smoker status (optional)' },
            diabetic: { type: 'boolean', description: 'Diabetes diagnosis (optional)' },
            on_bp_meds: { type: 'boolean', description: 'On blood pressure medication (optional)' }
          },
          required: ['age', 'sex']
        },
        data_presence: {
          type: 'object',
          description: 'Available data markers',
          properties: {
            labs_available: {
              type: 'array',
              description: 'List of available lab markers (e.g., ["glucose", "total_chol", "hdl", "ast", "alt"])',
              items: { type: 'string' }
            },
            vitals_available: {
              type: 'array',
              description: 'List of available vital signs (e.g., ["systolic_bp", "diastolic_bp", "weight_kg"])',
              items: { type: 'string' }
            }
          },
          required: ['labs_available', 'vitals_available']
        }
      },
      required: ['user_profile', 'data_presence']
    }
  },
  {
    name: 'get_calculator_info',
    description: 'Get detailed information about available clinical calculators, their clinical uses, interpretation guidelines, and reference ranges.',
    inputSchema: {
      type: 'object',
      properties: {
        calculator: {
          type: 'string',
          enum: ['ascvd', 'fib4', 'nafld', 'egfr', 'ckd', 'homa_ir', 'all'],
          description: 'Specific calculator to get info about, or "all" for all calculators'
        }
      },
      required: ['calculator']
    }
  },
  {
    name: 'assess_thyroid_function',
    description: 'Comprehensive thyroid function assessment using TSH, Free T3, Free T4, Reverse T3, and TPO Antibodies. Detects hypothyroidism, hyperthyroidism, subclinical thyroid dysfunction, low T3 syndrome, and autoimmune thyroid disease (Hashimoto\'s). Calculates T3:T4 ratio (conversion efficiency) and T3:rT3 ratio (stress marker). Returns clinical interpretation, severity, and evidence-based recommendations per endocrinology guidelines.',
    inputSchema: {
      type: 'object',
      properties: {
        tsh: {
          type: 'number',
          description: 'TSH (Thyroid Stimulating Hormone) in mIU/L. Normal range: 0.4-4.0, Optimal for longevity: 1.0-2.5',
          minimum: 0
        },
        free_t3: {
          type: 'number',
          description: 'Free T3 (Triiodothyronine) in pg/mL. Normal range: 2.3-4.2, Optimal: 3.0-3.5',
          minimum: 0
        },
        free_t4: {
          type: 'number',
          description: 'Free T4 (Thyroxine) in ng/dL. Normal range: 0.8-1.8, Optimal: 1.0-1.3',
          minimum: 0
        },
        reverse_t3: {
          type: 'number',
          description: 'Reverse T3 in ng/dL. Normal range: 8-25, Optimal: <20',
          minimum: 0
        },
        tpo_antibodies: {
          type: 'number',
          description: 'TPO Antibodies (Anti-Thyroid Peroxidase) in IU/mL. Normal: <9, Elevated: >35 indicates Hashimoto\'s',
          minimum: 0
        }
      },
      required: ['tsh']
    }
  },
  {
    name: 'analyze_hormone_panel',
    description: 'Comprehensive hormone panel assessment for longevity and vitality optimization. Analyzes sex hormones (testosterone, estradiol, progesterone, SHBG) and adrenal hormones (DHEA-S, cortisol). Calculates Free Androgen Index, Testosterone/Estradiol ratio (for men), and age-adjusted DHEA-S scoring. Detects hypogonadism, PCOS, adrenal insufficiency, and chronic stress. Returns clinical interpretation, severity, and evidence-based recommendations per endocrinology guidelines.',
    inputSchema: {
      type: 'object',
      properties: {
        sex: {
          type: 'string',
          enum: ['male', 'female'],
          description: 'Biological sex (REQUIRED for accurate interpretation)'
        },
        age: {
          type: 'number',
          description: 'Age in years (for age-adjusted DHEA-S interpretation)',
          minimum: 0
        },
        total_testosterone: {
          type: 'number',
          description: 'Total Testosterone in ng/dL. Male optimal: 500-900, Female optimal: 15-70',
          minimum: 0
        },
        free_testosterone: {
          type: 'number',
          description: 'Free Testosterone in pg/mL. Male optimal: 50-200, Female optimal: 1-6',
          minimum: 0
        },
        estradiol: {
          type: 'number',
          description: 'Estradiol in pg/mL. Male optimal: 10-40, Female varies by cycle phase',
          minimum: 0
        },
        progesterone: {
          type: 'number',
          description: 'Progesterone in ng/mL (females). Luteal phase optimal: 5-20',
          minimum: 0
        },
        shbg: {
          type: 'number',
          description: 'Sex Hormone Binding Globulin in nmol/L. Used to calculate Free Androgen Index',
          minimum: 0
        },
        dhea_s: {
          type: 'number',
          description: 'DHEA-Sulfate in μg/dL. Longevity marker, declines with age',
          minimum: 0
        },
        cortisol: {
          type: 'number',
          description: 'Cortisol in μg/dL. Morning optimal: 10-20, Evening: <5',
          minimum: 0
        },
        time_of_day: {
          type: 'string',
          enum: ['morning', 'afternoon', 'evening'],
          description: 'Time of cortisol measurement (cortisol follows diurnal rhythm)'
        }
      },
      required: ['sex']
    }
  },
  {
    name: 'analyze_complete_blood_count',
    description: 'Comprehensive Complete Blood Count (CBC) assessment for blood health and immune function. Analyzes white blood cells (WBC), red blood cells (RBC), hemoglobin, hematocrit, and red cell indices (MCV, MCH, MCHC, RDW). Detects anemia (microcytic, macrocytic, normocytic), classifies likely causes (iron deficiency, B12/folate deficiency, chronic disease), assesses immune function, and identifies polycythemia. Returns clinical interpretation, anemia classification, severity, and evidence-based recommendations per hematology guidelines.',
    inputSchema: {
      type: 'object',
      properties: {
        sex: {
          type: 'string',
          enum: ['male', 'female'],
          description: 'Biological sex (for sex-specific anemia thresholds)'
        },
        age: {
          type: 'number',
          description: 'Age in years',
          minimum: 0
        },
        wbc: {
          type: 'number',
          description: 'White Blood Cell count in × 10⁹/L (or × 10³/μL). Normal: 4.5-11.0',
          minimum: 0
        },
        rbc: {
          type: 'number',
          description: 'Red Blood Cell count in × 10¹²/L (or × 10⁶/μL). Male: 4.5-5.9, Female: 4.0-5.2',
          minimum: 0
        },
        hemoglobin: {
          type: 'number',
          description: 'Hemoglobin in g/dL. Male: ≥13, Female: ≥12 (WHO anemia criteria)',
          minimum: 0
        },
        hematocrit: {
          type: 'number',
          description: 'Hematocrit in %. Male: ≥39%, Female: ≥36%',
          minimum: 0
        },
        mcv: {
          type: 'number',
          description: 'Mean Corpuscular Volume in fL. Normal: 80-100. Used to classify anemia type',
          minimum: 0
        },
        mch: {
          type: 'number',
          description: 'Mean Corpuscular Hemoglobin in pg. Normal: 27-33',
          minimum: 0
        },
        mchc: {
          type: 'number',
          description: 'Mean Corpuscular Hemoglobin Concentration in g/dL. Normal: 32-36',
          minimum: 0
        },
        rdw: {
          type: 'number',
          description: 'Red Cell Distribution Width in %. Normal: 11.5-14.5. Elevated suggests nutritional deficiency',
          minimum: 0
        }
      },
      required: []
    }
  },
  {
    name: 'analyze_advanced_lipids',
    description: 'Comprehensive advanced lipid panel assessment for superior cardiovascular risk prediction. Analyzes Apolipoprotein B (ApoB - all atherogenic particles), Lipoprotein(a) [Lp(a) - genetic risk factor], and LDL Particle Number (LDL-P - direct particle count). Detects LDL-P/LDL-C discordance (hidden CV risk), calculates ApoB/ApoA1 ratio, and provides risk stratification. Superior to standard lipid panel for CV risk assessment. Returns clinical interpretation, CV risk level, severity, and evidence-based recommendations per ACC/ESC guidelines.',
    inputSchema: {
      type: 'object',
      properties: {
        sex: {
          type: 'string',
          enum: ['male', 'female'],
          description: 'Biological sex'
        },
        age: {
          type: 'number',
          description: 'Age in years',
          minimum: 0
        },
        apob: {
          type: 'number',
          description: 'Apolipoprotein B in mg/dL. Optimal: <80, Desirable: <90, High: >130. Best marker for atherogenic particles',
          minimum: 0
        },
        lp_a: {
          type: 'number',
          description: 'Lipoprotein(a) in mg/dL. Optimal: <30, Elevated: >50, Very high: >75. Genetic CV risk factor (80% heritable)',
          minimum: 0
        },
        ldl_p: {
          type: 'number',
          description: 'LDL Particle Number in nmol/L. Optimal: <1000, Borderline: 1300-1600, High: >1600. Direct particle count',
          minimum: 0
        },
        ldl: {
          type: 'number',
          description: 'LDL cholesterol in mg/dL (for LDL-P/LDL-C discordance analysis)',
          minimum: 0
        },
        hdl: {
          type: 'number',
          description: 'HDL cholesterol in mg/dL (for ApoB/ApoA1 ratio estimation)',
          minimum: 0
        },
        total_chol: {
          type: 'number',
          description: 'Total cholesterol in mg/dL',
          minimum: 0
        },
        triglycerides: {
          type: 'number',
          description: 'Triglycerides in mg/dL',
          minimum: 0
        }
      },
      required: []
    }
  },
  {
    name: 'generate_health_story',
    description: 'ORCHESTRATOR TOOL: Generate comprehensive health story by analyzing complete health timeline. Calls all relevant MCP tools (calculate_risk_scores, analyze_lab_history, domain assessments, coverage analysis), builds RiskSummary, and generates patient narrative, doctor narrative, and visit prep. Returns complete HealthStory with MCP call log for transparency. This is the "one MCP to rule them all" for Health Dashboard.',
    inputSchema: {
      type: 'object',
      properties: {
        timeline: {
          type: 'object',
          description: 'Complete health timeline with context, labs, vitals, and wearables',
          properties: {
            context: {
              type: 'object',
              description: 'Patient context and demographics',
              properties: {
                age: { type: 'number', description: 'Age in years' },
                sex: { type: 'string', enum: ['male', 'female', 'other', 'unknown'], description: 'Biological sex' },
                race: { type: 'string', description: 'Race/ethnicity (optional)' },
                goals: { type: 'array', items: { type: 'string' }, description: 'Health goals (e.g., longevity, performance)' },
                concerns: { type: 'array', items: { type: 'string' }, description: 'Health concerns (e.g., fatigue, family history)' },
                conditions: { type: 'array', items: { type: 'string' }, description: 'Existing conditions' },
                medications: { type: 'array', items: { type: 'string' }, description: 'Current medications' },
                lifestyle: {
                  type: 'object',
                  properties: {
                    smoker: { type: 'boolean' },
                    alcohol_weekly_drinks: { type: 'number' },
                    exercise_minutes_per_week: { type: 'number' },
                    sleep_hours_per_night: { type: 'number' }
                  }
                }
              },
              required: ['age', 'sex']
            },
            labs: {
              type: 'array',
              description: 'Longitudinal lab history',
              items: {
                type: 'object',
                properties: {
                  date: { type: 'string', description: 'ISO date (YYYY-MM-DD)' },
                  context: { type: 'string', description: 'Context (e.g., Annual physical)' },
                  labs: { type: 'object', additionalProperties: { type: 'number' } }
                },
                required: ['date', 'labs']
              }
            },
            vitals: {
              type: 'object',
              description: 'Latest vitals',
              properties: {
                weight_kg: { type: 'number' },
                height_cm: { type: 'number' },
                systolic_bp: { type: 'number' },
                diastolic_bp: { type: 'number' },
                resting_heart_rate: { type: 'number' }
              }
            },
            wearables: {
              type: 'object',
              description: 'Wearables data (optional)',
              properties: {
                avg_steps_per_day: { type: 'number' },
                avg_sleep_hours: { type: 'number' },
                avg_resting_hr: { type: 'number' },
                hrv_avg: { type: 'number' },
                vo2_max: { type: 'number' }
              }
            },
            metadata: {
              type: 'object',
              properties: {
                created_at: { type: 'string' },
                updated_at: { type: 'string' },
                version: { type: 'string' }
              },
              required: ['created_at', 'updated_at', 'version']
            }
          },
          required: ['context', 'labs', 'metadata']
        }
      },
      required: ['timeline']
    }
  },
  {
    name: 'generate_clinical_narrative',
    description: 'LLM-POWERED: Generate dynamic clinical narratives using AI (OpenAI/Anthropic). Takes RiskSummary and patient context, generates patient narrative (empathetic, plain-English), doctor narrative (clinical, structured), or visit prep (questions + tests). Falls back to template-based generation if LLM unavailable. Returns narrative text, key points, and metadata.',
    inputSchema: {
      type: 'object',
      properties: {
        risk_summary: {
          type: 'object',
          description: 'RiskSummary from generate_health_story or analyze_lab_history',
          required: true
        },
        patient_context: {
          type: 'object',
          description: 'Optional patient context for personalization',
          properties: {
            age: { type: 'number' },
            sex: { type: 'string' },
            goals: { type: 'array', items: { type: 'string' }, description: 'Health goals (e.g., longevity, weight loss)' },
            concerns: { type: 'array', items: { type: 'string' }, description: 'Health concerns (e.g., fatigue, family history)' }
          }
        },
        narrative_type: {
          type: 'string',
          enum: ['patient', 'doctor', 'visit_prep'],
          description: 'Type of narrative to generate',
          required: true
        },
        tone: {
          type: 'string',
          enum: ['empathetic', 'clinical', 'actionable'],
          description: 'Narrative tone (default: empathetic for patient, clinical for doctor)'
        }
      },
      required: ['risk_summary', 'narrative_type']
    }
  },
  {
    name: 'predict_biomarkers',
    description: 'IMPUTATION ENGINE: Intelligently predict missing biomarkers using 30+ atomic models. Given lab results and user profile, fills missing values with confidence scores, evidence citations, and actionable recommendations. Returns high/moderate/low confidence predictions with "Get This Test" CTAs for actionable biomarkers. Perfect for enriching sparse lab panels.',
    inputSchema: {
      type: 'object',
      properties: {
        latest_labs: {
          type: 'object',
          description: 'Most recent lab snapshot (any available biomarkers)',
          properties: {
            totalCholesterol: { type: 'number', description: 'Total cholesterol (mg/dL)' },
            HDL: { type: 'number', description: 'HDL cholesterol (mg/dL)' },
            LDL: { type: 'number', description: 'LDL cholesterol (mg/dL)' },
            triglycerides: { type: 'number', description: 'Triglycerides (mg/dL)' },
            fastingGlucose: { type: 'number', description: 'Fasting glucose (mg/dL)' },
            fastingInsulin: { type: 'number', description: 'Fasting insulin (μU/mL)' },
            creatinine: { type: 'number', description: 'Serum creatinine (mg/dL)' },
            BUN: { type: 'number', description: 'Blood Urea Nitrogen (mg/dL)' },
            AST: { type: 'number', description: 'Aspartate aminotransferase (U/L)' },
            ALT: { type: 'number', description: 'Alanine aminotransferase (U/L)' },
            platelets: { type: 'number', description: 'Platelet count (×10⁹/L)' },
            WBC: { type: 'number', description: 'White blood cell count (×10⁹/L)' },
            neutrophils: { type: 'number', description: 'Neutrophils (×10⁹/L)' },
            lymphocytes: { type: 'number', description: 'Lymphocytes (×10⁹/L)' },
            hsCRP: { type: 'number', description: 'High-sensitivity C-reactive protein (mg/L)' },
            testosterone: { type: 'number', description: 'Total testosterone (ng/dL)' },
            SHBG: { type: 'number', description: 'Sex hormone-binding globulin (nmol/L)' },
            estradiol: { type: 'number', description: 'Estradiol (pg/mL)' },
            DHEAS: { type: 'number', description: 'DHEA-sulfate (μg/dL)' }
          }
        },
        user_profile: {
          type: 'object',
          description: 'User demographics and context',
          properties: {
            age: { type: 'number', description: 'Age in years', required: true },
            sex: { type: 'string', enum: ['male', 'female'], description: 'Biological sex', required: true },
            race: { type: 'string', enum: ['white', 'black', 'other'], description: 'Race (for eGFR calculation)' },
            height: { type: 'number', description: 'Height (cm)' },
            weight: { type: 'number', description: 'Weight (kg)' },
            waist_circumference: { type: 'number', description: 'Waist circumference (cm, for HOMA-IR estimate)' }
          },
          required: ['age', 'sex']
        },
        wearable_data: {
          type: 'object',
          description: 'Optional wearable data for predictive models (14-day averages)',
          properties: {
            sleep_duration_avg: { type: 'number', description: 'Average sleep duration (hours)' },
            sleep_efficiency_avg: { type: 'number', description: 'Average sleep efficiency (%)' },
            sleep_duration_sd: { type: 'number', description: 'Sleep duration standard deviation (hours)' },
            steps_avg: { type: 'number', description: 'Average steps per day' },
            steps_sd: { type: 'number', description: 'Steps standard deviation' },
            hrv_avg: { type: 'number', description: 'Average HRV (ms)' },
            hrv_sd: { type: 'number', description: 'HRV standard deviation (ms)' },
            resting_hr_avg: { type: 'number', description: 'Average resting heart rate (bpm)' },
            activity_variability: { type: 'number', description: 'Active minutes variability (0-1)' },
            screen_time_min: { type: 'number', description: 'Daily screen time (minutes)' }
          }
        }
      },
      required: ['latest_labs', 'user_profile']
    }
  },
  {
    name: 'extract_labs_from_text',
    description: 'INTELLIGENT OCR: Extract lab values from OCR text using hybrid approach (regex patterns + optional LLM). Supports all 60 markers in catalogue. Returns structured extractions with confidence scores, flags uncertain values for manual review. Graceful degradation: uses patterns if LLM unavailable. Perfect for PDF lab report parsing.',
    inputSchema: {
      type: 'object',
      properties: {
        ocr_text: {
          type: 'string',
          description: 'Raw text extracted from lab report (via Tesseract OCR or similar)',
          required: true
        },
        marker_catalogue: {
          type: 'array',
          items: { type: 'string' },
          description: 'Optional: specific markers to look for (e.g., ["glucose", "hba1c"]). Default: all 60 markers'
        },
        extraction_mode: {
          type: 'string',
          enum: ['pattern', 'llm', 'hybrid'],
          description: 'Extraction strategy: pattern (fast, deterministic), llm (flexible, requires API), hybrid (best of both)',
          default: 'hybrid'
        }
      },
      required: ['ocr_text']
    }
  },
  
  {
    name: 'parse_apple_health_export',
    description: 'TIMELINE BUILDER: Parse Apple Health export ZIP to extract activity, vitals, and fitness data. Creates a comprehensive daily timeline with steps, heart rate, sleep, workouts, and 20+ health metrics. Perfect for longitudinal health analysis and trajectory modeling. Returns structured timeline ready for health score calculations.',
    inputSchema: {
      type: 'object',
      properties: {
        export_data: {
          type: 'string',
          description: 'Apple Health export ZIP file (as base64) or export.xml content',
          required: true
        },
        data_type: {
          type: 'string',
          enum: ['zip_base64', 'xml'],
          description: 'Format of export_data: zip_base64 (full export) or xml (export.xml content)',
          default: 'zip_base64'
        },
        aggregation: {
          type: 'string',
          enum: ['daily', 'weekly', 'monthly'],
          description: 'Time granularity for metric aggregation',
          default: 'daily'
        },
        date_range: {
          type: 'object',
          properties: {
            start_date: { type: 'string', description: 'YYYY-MM-DD format (optional)' },
            end_date: { type: 'string', description: 'YYYY-MM-DD format (optional)' }
          },
          description: 'Optional date range filter for timeline data'
        }
      },
      required: ['export_data']
    }
  },
  {
    name: 'analyze_correlations',
    description: 'Detect statistical correlations between lab markers and wearable metrics (e.g., steps ↔ glucose, sleep ↔ cortisol). Uses Pearson correlation with significance testing to identify meaningful relationships in longitudinal health data.',
    inputSchema: {
      type: 'object',
      properties: {
        timeline: {
          type: 'object',
          description: 'Complete health timeline with labs, vitals, and wearables data',
          properties: {
            user_profile: { type: 'object' },
            lab_history: { type: 'array' },
            vitals: { type: 'object' },
            wearables: { type: 'object' }
          },
          required: ['user_profile']
        },
        metrics_of_interest: {
          type: 'array',
          items: { type: 'string' },
          description: 'Specific metrics to analyze (default: all available). Examples: glucose, steps, resting_hr, sleep, hdl, exercise',
          default: ['glucose', 'hba1c', 'steps', 'resting_hr', 'sleep', 'exercise', 'hdl', 'ldl']
        }
      },
      required: ['timeline']
    }
  },
  {
    name: 'get_timeline_data',
    description: 'Query and aggregate timeline data for visualization. Extract specific metrics over time windows (30/90/365 days) with summary statistics for charting.',
    inputSchema: {
      type: 'object',
      properties: {
        timeline: {
          type: 'object',
          description: 'Complete health timeline',
          required: true
        },
        metrics: {
          type: 'array',
          items: { type: 'string' },
          description: 'Metrics to query (e.g., glucose, steps, resting_hr, sleep, hdl)',
          required: true
        },
        time_window: {
          type: 'string',
          enum: ['30d', '90d', '365d', 'all'],
          description: 'Time window for data query',
          default: 'all'
        },
        aggregation: {
          type: 'string',
          enum: ['daily', 'weekly', 'monthly'],
          description: 'Aggregation level for data points',
          default: 'daily'
        }
      },
      required: ['timeline', 'metrics']
    }
  },
  {
    name: 'generate_timeline_export',
    description: 'Export health timeline data in CSV, JSON, or XLSX format for external analysis, backup, or integration with other health tools.',
    inputSchema: {
      type: 'object',
      properties: {
        timeline: {
          type: 'object',
          description: 'Complete health timeline to export',
          required: true
        },
        format: {
          type: 'string',
          enum: ['csv', 'json', 'xlsx'],
          description: 'Export format',
          default: 'csv'
        },
        include_labs: {
          type: 'boolean',
          description: 'Include lab history in export',
          default: true
        },
        include_vitals: {
          type: 'boolean',
          description: 'Include vitals in export',
          default: true
        },
        include_wearables: {
          type: 'boolean',
          description: 'Include wearable metrics in export',
          default: true
        },
        metrics: {
          type: 'array',
          items: { type: 'string' },
          description: 'Specific metrics to export (default: all)'
        }
      },
      required: ['timeline', 'format']
    }
  },
  
  // ============================================================================
  // TIER 1: DETERMINISTIC BIOMARKER PREDICTION MCPS (10 atomic tools)
  // ============================================================================
  
  {
    name: 'calculate_apob',
    description: 'Predict Apolipoprotein B (apoB) from standard lipid panel using validated Mora et al. formula (R²=0.88). apoB is a superior predictor of cardiovascular disease vs LDL cholesterol.',
    inputSchema: {
      type: 'object',
      properties: {
        total_cholesterol: { type: 'number', description: 'Total cholesterol (mg/dL)' },
        hdl_cholesterol: { type: 'number', description: 'HDL cholesterol (mg/dL)' },
        triglycerides: { type: 'number', description: 'Triglycerides (mg/dL)' }
      },
      required: ['total_cholesterol', 'hdl_cholesterol', 'triglycerides']
    }
  },
  
  {
    name: 'calculate_non_hdl',
    description: 'Calculate non-HDL cholesterol (Total - HDL). Secondary lipid treatment target per AHA/ACC guidelines. Captures all atherogenic particles.',
    inputSchema: {
      type: 'object',
      properties: {
        total_cholesterol: { type: 'number', description: 'Total cholesterol (mg/dL)' },
        hdl_cholesterol: { type: 'number', description: 'HDL cholesterol (mg/dL)' }
      },
      required: ['total_cholesterol', 'hdl_cholesterol']
    }
  },
  
  {
    name: 'calculate_sdldl_pattern',
    description: 'Predict LDL particle pattern (A=large/fluffy vs B=small/dense) from TG/HDL ratio. Pattern B is 3× more atherogenic. R²=0.75 per McLaughlin et al.',
    inputSchema: {
      type: 'object',
      properties: {
        triglycerides: { type: 'number', description: 'Triglycerides (mg/dL)' },
        hdl_cholesterol: { type: 'number', description: 'HDL cholesterol (mg/dL)' }
      },
      required: ['triglycerides', 'hdl_cholesterol']
    }
  },
  
  {
    name: 'calculate_tg_hdl_ratio',
    description: 'Calculate TG/HDL ratio, a powerful marker of insulin resistance. Ratio >3.0 predicts insulin resistance with 82% sensitivity.',
    inputSchema: {
      type: 'object',
      properties: {
        triglycerides: { type: 'number', description: 'Triglycerides (mg/dL)' },
        hdl_cholesterol: { type: 'number', description: 'HDL cholesterol (mg/dL)' }
      },
      required: ['triglycerides', 'hdl_cholesterol']
    }
  },
  
  {
    name: 'calculate_tc_hdl_ratio',
    description: 'Calculate Total Cholesterol/HDL ratio, a cardiovascular risk indicator. Target <3.5 for optimal health.',
    inputSchema: {
      type: 'object',
      properties: {
        total_cholesterol: { type: 'number', description: 'Total cholesterol (mg/dL)' },
        hdl_cholesterol: { type: 'number', description: 'HDL cholesterol (mg/dL)' }
      },
      required: ['total_cholesterol', 'hdl_cholesterol']
    }
  },
  
  {
    name: 'calculate_homa_ir',
    description: 'Calculate HOMA-IR (Homeostatic Model Assessment of Insulin Resistance), the gold standard for insulin resistance assessment. R=0.88 vs clamp.',
    inputSchema: {
      type: 'object',
      properties: {
        fasting_glucose: { type: 'number', description: 'Fasting glucose (mg/dL)' },
        fasting_insulin: { type: 'number', description: 'Fasting insulin (μU/mL)' }
      },
      required: ['fasting_glucose', 'fasting_insulin']
    }
  },
  
  {
    name: 'estimate_hba1c_from_glucose',
    description: 'Estimate HbA1c from fasting glucose using Nathan formula (R²=0.84). Reflects 3-month average blood sugar. Direct test recommended for diagnosis.',
    inputSchema: {
      type: 'object',
      properties: {
        fasting_glucose: { type: 'number', description: 'Fasting glucose (mg/dL)' }
      },
      required: ['fasting_glucose']
    }
  },
  
  {
    name: 'calculate_egfr_ckd_epi',
    description: 'Calculate eGFR (estimated Glomerular Filtration Rate) using CKD-EPI 2021 equation (race-neutral). Measures kidney function. R²=0.92.',
    inputSchema: {
      type: 'object',
      properties: {
        creatinine: { type: 'number', description: 'Serum creatinine (mg/dL)' },
        age: { type: 'number', description: 'Age in years' },
        sex: { type: 'string', enum: ['male', 'female'], description: 'Biological sex' },
        race: { type: 'string', enum: ['black', 'white', 'other'], description: 'Race (optional, for legacy comparisons)' }
      },
      required: ['creatinine', 'age', 'sex']
    }
  },
  
  {
    name: 'calculate_bun_creatinine_ratio',
    description: 'Calculate BUN/Creatinine ratio to assess hydration status and kidney function. Ratio >20 suggests dehydration or prerenal azotemia.',
    inputSchema: {
      type: 'object',
      properties: {
        bun: { type: 'number', description: 'Blood Urea Nitrogen (mg/dL)' },
        creatinine: { type: 'number', description: 'Serum creatinine (mg/dL)' }
      },
      required: ['bun', 'creatinine']
    }
  },
  
  {
    name: 'calculate_ast_alt_ratio',
    description: 'Calculate AST/ALT ratio to differentiate liver disease patterns. Ratio >2.0 suggests alcoholic liver disease, <1.0 with elevated ALT suggests NAFLD.',
    inputSchema: {
      type: 'object',
      properties: {
        ast: { type: 'number', description: 'Aspartate aminotransferase (U/L)' },
        alt: { type: 'number', description: 'Alanine aminotransferase (U/L)' }
      },
      required: ['ast', 'alt']
    }
  },
  
  // ========================================================================
  // ATOMIC BIOMARKER PREDICTION MODELS (TIER 1 DETERMINISTIC)
  // Added: Week 1 Day 1 - MCP-First Architecture
  // ========================================================================
  
  {
    name: 'calculate_apob',
    description: 'ATOMIC MODEL: Predict Apolipoprotein B (apoB) from standard lipid panel. apoB is superior to LDL for CVD risk prediction. Formula from Mora et al. 2020 (R²=0.88, validated in 27,000 women). Returns predicted apoB with 95% CI, optimal thresholds (<90 optimal, 90-120 elevated, >120 high risk), and evidence citations.',
    inputSchema: {
      type: 'object',
      properties: {
        total_cholesterol: { type: 'number', description: 'Total cholesterol (mg/dL)' },
        hdl: { type: 'number', description: 'HDL cholesterol (mg/dL)' },
        triglycerides: { type: 'number', description: 'Triglycerides (mg/dL)' }
      },
      required: ['total_cholesterol', 'hdl', 'triglycerides']
    }
  },
  
  {
    name: 'calculate_sdldl_pattern',
    description: 'ATOMIC MODEL: Classify LDL particle pattern (A vs B) using TG/HDL ratio. Pattern B (small, dense LDL) is 3× more atherogenic than Pattern A (large, fluffy LDL). McLaughlin et al. 2003 (R²=0.75). TG/HDL >2.0 predicts Pattern B with 75% accuracy. Returns pattern classification and cardiovascular implications.',
    inputSchema: {
      type: 'object',
      properties: {
        triglycerides: { type: 'number', description: 'Triglycerides (mg/dL)' },
        hdl: { type: 'number', description: 'HDL cholesterol (mg/dL)' }
      },
      required: ['triglycerides', 'hdl']
    }
  },
  
  {
    name: 'calculate_non_hdl',
    description: 'ATOMIC MODEL: Calculate Non-HDL cholesterol (all atherogenic particles: LDL + VLDL + IDL + Lp(a)). Secondary lipid target per 2018 AHA/ACC Guidelines. Optimal <130 mg/dL, High ≥190 mg/dL. Direct calculation (100% accurate).',
    inputSchema: {
      type: 'object',
      properties: {
        total_cholesterol: { type: 'number', description: 'Total cholesterol (mg/dL)' },
        hdl: { type: 'number', description: 'HDL cholesterol (mg/dL)' }
      },
      required: ['total_cholesterol', 'hdl']
    }
  },
  
  {
    name: 'calculate_tc_hdl_ratio',
    description: 'ATOMIC MODEL: Calculate Total Cholesterol/HDL ratio. Classic CVD risk marker. Ratio >5.0 doubles CVD risk vs <3.5. Optimal <3.5 for men, <3.0 for women. Direct calculation.',
    inputSchema: {
      type: 'object',
      properties: {
        total_cholesterol: { type: 'number', description: 'Total cholesterol (mg/dL)' },
        hdl: { type: 'number', description: 'HDL cholesterol (mg/dL)' }
      },
      required: ['total_cholesterol', 'hdl']
    }
  },
  
  {
    name: 'calculate_tg_hdl_ratio',
    description: 'ATOMIC MODEL: Calculate TG/HDL ratio as insulin resistance marker. McLaughlin et al. 2003 (R²=0.72 vs hyperinsulinemic clamp). TG/HDL >3.0 predicts insulin resistance with 72% accuracy. <2.0 = low IR, 2.0-4.0 = moderate IR, >4.0 = high IR (metabolic syndrome, pre-diabetes risk).',
    inputSchema: {
      type: 'object',
      properties: {
        triglycerides: { type: 'number', description: 'Triglycerides (mg/dL)' },
        hdl: { type: 'number', description: 'HDL cholesterol (mg/dL)' }
      },
      required: ['triglycerides', 'hdl']
    }
  },
  
  {
    name: 'calculate_homa_ir',
    description: 'ATOMIC MODEL: Calculate HOMA-IR (Homeostatic Model Assessment of Insulin Resistance). Gold standard formula from Matthews et al. 1985. Requires fasting glucose + fasting insulin. HOMA-IR ≥2.9 = insulin resistance (pre-diabetes). Direct formula (100% accurate).',
    inputSchema: {
      type: 'object',
      properties: {
        fasting_glucose: { type: 'number', description: 'Fasting glucose (mg/dL)' },
        fasting_insulin: { type: 'number', description: 'Fasting insulin (μU/mL)' }
      },
      required: ['fasting_glucose', 'fasting_insulin']
    }
  },
  
  {
    name: 'estimate_homa_ir_from_lipids',
    description: 'ATOMIC MODEL: Estimate HOMA-IR without insulin test using glucose + anthropometrics + lipids. Stern et al. 2005 NHANES regression (R²=0.62). Returns estimated HOMA-IR ± uncertainty. Use when fasting insulin unavailable. Recommend confirming with actual insulin test if estimated HOMA-IR >2.9.',
    inputSchema: {
      type: 'object',
      properties: {
        fasting_glucose: { type: 'number', description: 'Fasting glucose (mg/dL)' },
        waist_circumference: { type: 'number', description: 'Waist circumference (cm)' },
        bmi: { type: 'number', description: 'Body Mass Index (kg/m²)' },
        triglycerides: { type: 'number', description: 'Triglycerides (mg/dL)' },
        hdl: { type: 'number', description: 'HDL cholesterol (mg/dL)' }
      },
      required: ['fasting_glucose', 'waist_circumference', 'bmi', 'triglycerides', 'hdl']
    }
  },
  
  {
    name: 'estimate_hba1c_from_glucose',
    description: 'ATOMIC MODEL: Estimate HbA1c from single fasting glucose using Nathan formula (R²=0.84). ADAG study 2008. Returns estimated HbA1c ± 0.5%. Thresholds: <5.7% normal, 5.7-6.4% prediabetes, ≥6.5% diabetes. Recommend actual HbA1c test ($20-30, no fasting) for diagnosis.',
    inputSchema: {
      type: 'object',
      properties: {
        fasting_glucose: { type: 'number', description: 'Fasting glucose (mg/dL)' }
      },
      required: ['fasting_glucose']
    }
  },
  
  {
    name: 'calculate_egfr_ckd_epi',
    description: 'ATOMIC MODEL: Calculate eGFR (estimated Glomerular Filtration Rate) using CKD-EPI 2021 race-free equation. Inker et al. NEJM 2021 (R²=0.92). Returns eGFR with CKD stage classification. eGFR <60 for >3 months = chronic kidney disease. Stage 1-5 classification with clinical recommendations.',
    inputSchema: {
      type: 'object',
      properties: {
        creatinine: { type: 'number', description: 'Serum creatinine (mg/dL)' },
        age: { type: 'number', description: 'Age in years' },
        sex: { type: 'string', enum: ['male', 'female'], description: 'Biological sex' }
      },
      required: ['creatinine', 'age', 'sex']
    }
  },
  
  {
    name: 'calculate_fib4',
    description: 'ATOMIC MODEL: Calculate FIB-4 score for liver fibrosis screening. Sterling et al. Hepatology 2006 (AUC=0.80). Formula: (Age × AST) / (Platelets × √ALT). Thresholds: <1.45 low risk, 1.45-3.25 indeterminate (FibroScan needed), >3.25 high risk of advanced fibrosis/cirrhosis. Non-invasive alternative to biopsy.',
    inputSchema: {
      type: 'object',
      properties: {
        age: { type: 'number', description: 'Age in years' },
        ast: { type: 'number', description: 'Aspartate aminotransferase (U/L)' },
        alt: { type: 'number', description: 'Alanine aminotransferase (U/L)' },
        platelets: { type: 'number', description: 'Platelet count (10⁹/L or ×10³/μL)' }
      },
      required: ['age', 'ast', 'alt', 'platelets']
    }
  }
]

// Helper function to filter timeline by date range
function filterTimelineByDateRange(timeline: any, startDate?: string, endDate?: string): any {
  if (!startDate && !endDate) return timeline
  
  const start = startDate ? new Date(startDate) : new Date(0)
  const end = endDate ? new Date(endDate) : new Date()
  
  const filterMetrics = (metrics: any[]) => 
    metrics.filter(m => {
      const date = new Date(m.date)
      return date >= start && date <= end
    })
  
  return {
    ...timeline,
    daily_metrics: Object.fromEntries(
      Object.entries(timeline.daily_metrics).map(([key, metrics]) => [
        key,
        filterMetrics(metrics as any[])
      ])
    ),
    sleep_sessions: filterMetrics(timeline.sleep_sessions),
    workouts: filterMetrics(timeline.workouts)
  }
}

export async function executeHealthGuildTool(
  toolName: string,
  args: any
): Promise<MCPToolResult> {
  try {
    switch (toolName) {
      case 'calculate_risk_scores': {
        const { user_profile, labs } = args
        
        // Validate required fields
        if (!user_profile || !labs) {
          throw new Error('Missing required fields: user_profile and labs')
        }

        // Calculate risk scores WITH metadata
        const { results, metadata } = computeRiskScoresWithMetadata(
          user_profile as CalculatorUserProfile, 
          labs as Labs
        )

        // Format results for MCP with metadata
        const formattedResults = {
          summary: 'Clinical Risk Assessment Results',
          timestamp: new Date().toISOString(),
          scores: formatRiskScoresForMCP(results),
          _meta: {
            format_version: '1.0.0',
            schema_url: 'https://health-guild-mcp.pages.dev/schemas/risk-scores.json',
            models_ran: metadata.models_ran,
            models_skipped: metadata.models_skipped
          }
        }

        return {
          content: [{
            type: 'text',
            text: JSON.stringify(formattedResults, null, 2)
          }]
        }
      }

      case 'analyze_lab_history': {
        const { user_profile, lab_history } = args
        
        // Validate required fields
        if (!user_profile || !lab_history || lab_history.length === 0) {
          throw new Error('Missing required fields: user_profile and lab_history (at least 1 snapshot)')
        }

        // Analyze trends
        const trends = analyzeTrends(lab_history as LabSnapshot[])

        // Calculate domain scores
        const domainScores = calculateDomainScores(
          user_profile as UserProfile,
          lab_history as LabSnapshot[],
          trends
        )

        // Calculate derived ratios
        const derivedRatios = calculateDerivedRatios(lab_history as LabSnapshot[])

        // Analyze marker utilization
        const markerUtilization = analyzeMarkerUtilization(lab_history as LabSnapshot[])

        // Calculate overall health index
        const healthIndex = calculateHealthIndex(domainScores)
        const healthBadge = getHealthIndexBadge(healthIndex.overall_health_index)

        // Generate recommendations
        const recommendations: any[] = []
        
        // Add trend-based recommendations
        const worseningTrends = trends.filter(t => t.direction === 'worsening')
        worseningTrends.slice(0, 3).forEach(trend => {
          recommendations.push({
            type: 'trend_to_discuss',
            related_markers: [trend.marker],
            message: `${trend.marker} is showing a worsening trend. Consider discussing with your healthcare provider.`
          })
        })

        // Add domain-based recommendations
        const concerningDomains = domainScores.filter(d => d.status === 'concerning')
        concerningDomains.forEach(domain => {
          recommendations.push({
            type: 'general_context',
            related_domain: domain.domain,
            related_markers: [],
            message: `Your ${domain.domain} domain score indicates room for improvement. ${domain.rationale}`
          })
        })

        // Build transparency metadata (models_ran and models_skipped)
        const modelsRan: any[] = []
        const modelsSkipped: any[] = []
        
        // Check which domain scoring models ran
        domainScores.forEach(domain => {
          modelsRan.push({
            name: `${domain.domain.charAt(0).toUpperCase() + domain.domain.slice(1)} Domain Score`,
            calculator: `domain_${domain.domain}`,
            evidence_tier: 'C',  // Domain scores are proprietary algorithms
            inputs_used: ['lab_history', 'trends']
          })
        })
        
        // Add health index model
        if (healthIndex.overall_health_index !== null) {
          modelsRan.push({
            name: 'Overall Health Index',
            calculator: 'health_index',
            evidence_tier: 'C',
            inputs_used: ['domain_scores']
          })
        }
        
        // Add trend analysis model
        if (trends.length > 0) {
          modelsRan.push({
            name: 'Longitudinal Trend Analysis',
            calculator: 'trend_analysis',
            evidence_tier: 'C',
            inputs_used: ['lab_history']
          })
        }

        // Add derived ratio models
        derivedRatios.forEach(ratio => {
          modelsRan.push({
            name: ratio.ratio_name,
            calculator: `derived_ratio_${ratio.markers_used.join('_')}`,
            evidence_tier: ratio.evidence_tier,
            inputs_used: ratio.markers_used
          })
        })

        // Format response with metadata
        const formattedResults = {
          summary: 'Longitudinal Health Analysis',
          timestamp: new Date().toISOString(),
          health_index: {
            score: healthIndex.overall_health_index,
            badge: healthBadge,
            narrative: healthIndex.narrative,
            strongest_domain: healthIndex.strongest_domain,
            weakest_domain: healthIndex.weakest_domain
          },
          domain_scores: domainScores,
          marker_trends: trends,
          derived_ratios: derivedRatios,
          marker_utilization: markerUtilization,
          recommendations,
          models_ran: modelsRan,
          models_skipped: modelsSkipped,
          _meta: {
            format_version: '1.0.0',
            schema_url: 'https://health-guild-mcp.pages.dev/schemas/lab-history.json',
            data_points_analyzed: lab_history.length,
            date_range: {
              earliest: lab_history[0]?.date,
              latest: lab_history[lab_history.length - 1]?.date
            },
            unique_markers: trends.length,
            marker_utilization_percent: markerUtilization.utilization_percent
          }
        }

        return {
          content: [{
            type: 'text',
            text: JSON.stringify(formattedResults, null, 2)
          }]
        }
      }

      case 'health_coverage_map': {
        const { user_profile, data_presence } = args
        
        // Validate required fields
        if (!user_profile || !data_presence) {
          throw new Error('Missing required fields: user_profile and data_presence')
        }

        const { labs_available, vitals_available } = data_presence

        // Analyze domain coverage
        const domainCoverage = analyzeDomainCoverage(
          labs_available || [],
          vitals_available || []
        )

        // Analyze model coverage
        const modelCoverage = analyzeModelCoverage(
          user_profile,
          labs_available || [],
          vitals_available || []
        )

        // Suggest additional data
        const suggestions = suggestAdditionalData(modelCoverage, domainCoverage)

        // Calculate summary statistics
        const fullySupported = modelCoverage.filter(m => m.status === 'fully_supported').length
        const blocked = modelCoverage.filter(m => m.status === 'blocked').length
        const totalModels = modelCoverage.length
        const coveragePercent = Math.round((fullySupported / totalModels) * 100)

        // Format response with metadata
        const formattedResults = {
          summary: 'Health Data Coverage Analysis',
          timestamp: new Date().toISOString(),
          coverage_summary: {
            fully_supported_models: fullySupported,
            partially_supported_models: modelCoverage.filter(m => m.status === 'partially_supported').length,
            blocked_models: blocked,
            total_models: totalModels,
            coverage_percent: coveragePercent
          },
          domains: domainCoverage,
          models: modelCoverage,
          suggested_additional_data: suggestions,
          _meta: {
            format_version: '1.0.0',
            schema_url: 'https://health-guild-mcp.pages.dev/schemas/coverage-map.json',
            labs_analyzed: labs_available?.length || 0,
            vitals_analyzed: vitals_available?.length || 0
          }
        }

        return {
          content: [{
            type: 'text',
            text: JSON.stringify(formattedResults, null, 2)
          }]
        }
      }

      case 'get_calculator_info': {
        const { calculator } = args
        const info = getCalculatorInfo(calculator)
        
        return {
          content: [{
            type: 'text',
            text: JSON.stringify(info, null, 2)
          }]
        }
      }

      case 'assess_thyroid_function': {
        const { tsh, free_t3, free_t4, reverse_t3, tpo_antibodies } = args
        
        // Validate TSH (required)
        if (!tsh || tsh <= 0) {
          throw new Error('TSH is required and must be a positive number')
        }

        // Assess thyroid function
        const thyroidStatus = assessThyroidFunction(tsh, free_t3, free_t4)
        
        // Calculate ratios if data available
        const ratios: any = {}
        const models_ran: any[] = []
        
        // T3:rT3 ratio
        if (free_t3 && reverse_t3) {
          const t3rT3Result = calculateT3ReverseT3Ratio(free_t3, reverse_t3)
          ratios.t3_reverse_t3 = t3rT3Result
          models_ran.push({
            name: 'T3:Reverse T3 Ratio',
            calculator: 't3_rt3_ratio',
            evidence_tier: 'B',
            inputs_used: ['free_t3', 'reverse_t3'],
            result: `${t3rT3Result.ratio} (${t3rT3Result.status})`
          })
        }
        
        // T3:T4 ratio
        if (free_t3 && free_t4) {
          const t3T4Result = calculateT3T4Ratio(free_t3, free_t4)
          ratios.t3_t4 = t3T4Result
          models_ran.push({
            name: 'T3:T4 Ratio',
            calculator: 't3_t4_ratio',
            evidence_tier: 'B',
            inputs_used: ['free_t3', 'free_t4'],
            result: `${t3T4Result.ratio} (${t3T4Result.status})`
          })
        }
        
        // Hashimoto's risk
        let hashimotosRisk = null
        if (tpo_antibodies !== undefined) {
          hashimotosRisk = assessHashimotosRisk(tpo_antibodies, tsh)
          models_ran.push({
            name: 'Hashimoto\'s Thyroiditis Risk Assessment',
            calculator: 'hashimotos_risk',
            evidence_tier: 'A',
            inputs_used: tsh ? ['tpo_antibodies', 'tsh'] : ['tpo_antibodies'],
            result: `${hashimotosRisk.risk} risk`
          })
        }
        
        // Main thyroid function assessment model
        models_ran.unshift({
          name: 'Thyroid Function Assessment',
          calculator: 'thyroid_function',
          evidence_tier: 'A',
          inputs_used: [
            'tsh',
            free_t3 ? 'free_t3' : null,
            free_t4 ? 'free_t4' : null
          ].filter(Boolean),
          result: `${thyroidStatus.status} (${thyroidStatus.severity})`
        })
        
        // Format comprehensive response
        const formattedResults = {
          summary: 'Thyroid Function Assessment',
          timestamp: new Date().toISOString(),
          thyroid_status: {
            status: thyroidStatus.status,
            severity: thyroidStatus.severity,
            interpretation: thyroidStatus.interpretation,
            recommendations: thyroidStatus.recommendations
          },
          markers: {
            tsh: { value: tsh, unit: 'mIU/L' },
            ...(free_t3 && { free_t3: { value: free_t3, unit: 'pg/mL' } }),
            ...(free_t4 && { free_t4: { value: free_t4, unit: 'ng/dL' } }),
            ...(reverse_t3 && { reverse_t3: { value: reverse_t3, unit: 'ng/dL' } }),
            ...(tpo_antibodies !== undefined && { tpo_antibodies: { value: tpo_antibodies, unit: 'IU/mL' } })
          },
          ...(Object.keys(ratios).length > 0 && { ratios }),
          ...(hashimotosRisk && { hashimotos_risk: hashimotosRisk }),
          models_ran,
          _meta: {
            format_version: '1.0.0',
            schema_url: 'https://health-guild-mcp.pages.dev/schemas/thyroid-assessment.json',
            models_count: models_ran.length,
            clinical_guidelines: [
              'American Thyroid Association (ATA) Guidelines',
              'Endocrine Society Clinical Practice Guidelines',
              'AACE Thyroid Guidelines'
            ]
          }
        }

        return {
          content: [{
            type: 'text',
            text: JSON.stringify(formattedResults, null, 2)
          }]
        }
      }

      case 'analyze_hormone_panel': {
        const hormoneInputs: HormoneInputs = {
          sex: args.sex,
          age: args.age,
          total_testosterone: args.total_testosterone,
          free_testosterone: args.free_testosterone,
          estradiol: args.estradiol,
          progesterone: args.progesterone,
          shbg: args.shbg,
          dhea_s: args.dhea_s,
          cortisol: args.cortisol,
          time_of_day: args.time_of_day
        }
        
        // Validate sex (required)
        if (!hormoneInputs.sex) {
          throw new Error('Sex is required for hormone panel assessment')
        }
        
        // Assess hormone panel
        const assessment = assessHormonePanel(hormoneInputs)
        
        // Format comprehensive response
        const formattedResults = {
          summary: 'Hormone Panel Assessment',
          timestamp: new Date().toISOString(),
          hormone_status: {
            overall_status: assessment.overall_status,
            severity: assessment.severity,
            interpretation: assessment.interpretation,
            recommendations: assessment.recommendations
          },
          markers: {
            ...(args.total_testosterone !== undefined && { 
              total_testosterone: { value: args.total_testosterone, unit: 'ng/dL' } 
            }),
            ...(args.free_testosterone !== undefined && { 
              free_testosterone: { value: args.free_testosterone, unit: 'pg/mL' } 
            }),
            ...(args.estradiol !== undefined && { 
              estradiol: { value: args.estradiol, unit: 'pg/mL' } 
            }),
            ...(args.progesterone !== undefined && { 
              progesterone: { value: args.progesterone, unit: 'ng/mL' } 
            }),
            ...(args.shbg !== undefined && { 
              shbg: { value: args.shbg, unit: 'nmol/L' } 
            }),
            ...(args.dhea_s !== undefined && { 
              dhea_s: { value: args.dhea_s, unit: 'μg/dL' } 
            }),
            ...(args.cortisol !== undefined && { 
              cortisol: { value: args.cortisol, unit: 'μg/dL' } 
            })
          },
          ...(assessment.calculated_ratios && Object.keys(assessment.calculated_ratios).length > 0 && {
            calculated_ratios: assessment.calculated_ratios
          }),
          models_ran: assessment.models_ran,
          _meta: {
            format_version: '1.0.0',
            schema_url: 'https://health-guild-mcp.pages.dev/schemas/hormone-assessment.json',
            models_count: assessment.models_ran.length,
            markers_analyzed: assessment.markers_analyzed,
            clinical_guidelines: [
              'Endocrine Society Clinical Practice Guidelines',
              'American Association of Clinical Endocrinologists (AACE)',
              'Journal of Clinical Endocrinology & Metabolism'
            ]
          }
        }

        return {
          content: [{
            type: 'text',
            text: JSON.stringify(formattedResults, null, 2)
          }]
        }
      }

      case 'analyze_complete_blood_count': {
        const cbcInputs: CBCInputs = {
          sex: args.sex,
          age: args.age,
          wbc: args.wbc,
          rbc: args.rbc,
          hemoglobin: args.hemoglobin,
          hematocrit: args.hematocrit,
          mcv: args.mcv,
          mch: args.mch,
          mchc: args.mchc,
          rdw: args.rdw
        }
        
        // Assess CBC
        const assessment = assessCBC(cbcInputs)
        
        // Format comprehensive response
        const formattedResults = {
          summary: 'Complete Blood Count Assessment',
          timestamp: new Date().toISOString(),
          cbc_status: {
            overall_status: assessment.overall_status,
            severity: assessment.severity,
            interpretation: assessment.interpretation,
            recommendations: assessment.recommendations
          },
          markers: {
            ...(args.wbc !== undefined && { 
              wbc: { value: args.wbc, unit: '× 10⁹/L' } 
            }),
            ...(args.rbc !== undefined && { 
              rbc: { value: args.rbc, unit: '× 10¹²/L' } 
            }),
            ...(args.hemoglobin !== undefined && { 
              hemoglobin: { value: args.hemoglobin, unit: 'g/dL' } 
            }),
            ...(args.hematocrit !== undefined && { 
              hematocrit: { value: args.hematocrit, unit: '%' } 
            }),
            ...(args.mcv !== undefined && { 
              mcv: { value: args.mcv, unit: 'fL' } 
            }),
            ...(args.mch !== undefined && { 
              mch: { value: args.mch, unit: 'pg' } 
            }),
            ...(args.mchc !== undefined && { 
              mchc: { value: args.mchc, unit: 'g/dL' } 
            }),
            ...(args.rdw !== undefined && { 
              rdw: { value: args.rdw, unit: '%' } 
            })
          },
          ...(assessment.anemia_assessment && {
            anemia_assessment: assessment.anemia_assessment
          }),
          models_ran: assessment.models_ran,
          _meta: {
            format_version: '1.0.0',
            schema_url: 'https://health-guild-mcp.pages.dev/schemas/cbc-assessment.json',
            models_count: assessment.models_ran.length,
            markers_analyzed: assessment.markers_analyzed,
            clinical_guidelines: [
              'American Society of Hematology (ASH) Guidelines',
              'World Health Organization (WHO) Anemia Criteria',
              'Clinical Laboratory Standards Institute (CLSI)'
            ]
          }
        }

        return {
          content: [{
            type: 'text',
            text: JSON.stringify(formattedResults, null, 2)
          }]
        }
      }

      case 'analyze_advanced_lipids': {
        const advLipidsInputs: AdvancedLipidsInputs = {
          sex: args.sex,
          age: args.age,
          apob: args.apob,
          lp_a: args.lp_a,
          ldl_p: args.ldl_p,
          ldl: args.ldl,
          hdl: args.hdl,
          total_chol: args.total_chol,
          triglycerides: args.triglycerides
        }
        
        // Assess advanced lipids
        const assessment = assessAdvancedLipids(advLipidsInputs)
        
        // Format comprehensive response
        const formattedResults = {
          summary: 'Advanced Lipids Assessment',
          timestamp: new Date().toISOString(),
          lipids_status: {
            overall_status: assessment.overall_status,
            severity: assessment.severity,
            cv_risk_level: assessment.cv_risk_level,
            interpretation: assessment.interpretation,
            recommendations: assessment.recommendations
          },
          markers: {
            ...(args.apob !== undefined && { 
              apob: { value: args.apob, unit: 'mg/dL' } 
            }),
            ...(args.lp_a !== undefined && { 
              lp_a: { value: args.lp_a, unit: 'mg/dL' } 
            }),
            ...(args.ldl_p !== undefined && { 
              ldl_p: { value: args.ldl_p, unit: 'nmol/L' } 
            }),
            ...(args.ldl !== undefined && { 
              ldl: { value: args.ldl, unit: 'mg/dL' } 
            }),
            ...(args.hdl !== undefined && { 
              hdl: { value: args.hdl, unit: 'mg/dL' } 
            }),
            ...(args.total_chol !== undefined && { 
              total_chol: { value: args.total_chol, unit: 'mg/dL' } 
            }),
            ...(args.triglycerides !== undefined && { 
              triglycerides: { value: args.triglycerides, unit: 'mg/dL' } 
            })
          },
          ...(assessment.calculated_ratios && Object.keys(assessment.calculated_ratios).length > 0 && {
            calculated_ratios: assessment.calculated_ratios
          }),
          models_ran: assessment.models_ran,
          _meta: {
            format_version: '1.0.0',
            schema_url: 'https://health-guild-mcp.pages.dev/schemas/advanced-lipids-assessment.json',
            models_count: assessment.models_ran.length,
            markers_analyzed: assessment.markers_analyzed,
            clinical_guidelines: [
              'American College of Cardiology (ACC) Guidelines',
              'European Society of Cardiology (ESC) Guidelines',
              'National Lipid Association (NLA) Recommendations'
            ]
          }
        }

        return {
          content: [{
            type: 'text',
            text: JSON.stringify(formattedResults, null, 2)
          }]
        }
      }

      case 'generate_health_story': {
        // Extract timeline from args
        const timeline: HealthTimeline = args.timeline
        
        // Validate required fields
        if (!timeline || !timeline.context || !timeline.labs || !timeline.metadata) {
          throw new Error('Invalid HealthTimeline: missing required fields (context, labs, metadata)')
        }
        
        // Generate complete health story
        const healthStory = await generateHealthStory(timeline)
        
        return {
          content: [{
            type: 'text',
            text: JSON.stringify(healthStory, null, 2)
          }]
        }
      }

      case 'generate_clinical_narrative': {
        // Import LLM narrative generator
        const { generateClinicalNarrative } = await import('../engines/llmNarratives')
        
        // Extract args
        const { risk_summary, patient_context, narrative_type, tone } = args
        
        // Validate required fields
        if (!risk_summary) {
          throw new Error('Missing required field: risk_summary')
        }
        if (!narrative_type || !['patient', 'doctor', 'visit_prep'].includes(narrative_type)) {
          throw new Error('Invalid narrative_type. Must be: patient, doctor, or visit_prep')
        }
        
        // Generate narrative
        const result = await generateClinicalNarrative({
          risk_summary,
          patient_context,
          narrative_type,
          tone
        })
        
        return {
          content: [{
            type: 'text',
            text: JSON.stringify(result, null, 2)
          }]
        }
      }

      case 'predict_biomarkers': {
        // Import imputation engine
        const { imputeMissingBiomarkers } = await import('../engines/imputationEngine')
        
        // Extract args
        const { latest_labs, user_profile, wearable_data } = args
        
        // Validate required fields
        if (!latest_labs || typeof latest_labs !== 'object') {
          throw new Error('Missing or invalid required field: latest_labs (must be object)')
        }
        if (!user_profile || typeof user_profile !== 'object') {
          throw new Error('Missing or invalid required field: user_profile (must be object)')
        }
        if (!user_profile.age || !user_profile.sex) {
          throw new Error('user_profile must include age and sex')
        }
        
        // Run imputation engine
        const imputationReport = imputeMissingBiomarkers(
          latest_labs,
          user_profile,
          wearable_data
        )
        
        // Format response with summary
        const result = {
          summary: `Predicted ${imputationReport.total_imputed} biomarkers: ${imputationReport.high_confidence} high-confidence, ${imputationReport.moderate_confidence} moderate-confidence, ${imputationReport.low_confidence} low-confidence. ${imputationReport.skipped_markers.length} markers skipped due to missing inputs.`,
          timestamp: new Date().toISOString(),
          imputation_report: imputationReport,
          metadata: {
            schema: 'https://health-guild-mcp.pages.dev/schemas/imputation-report.json',
            models_run: imputationReport.imputed_markers.map(m => m.model_used),
            inputs_available: Object.keys(latest_labs),
            wearable_data_used: !!wearable_data
          }
        }
        
        return {
          content: [{
            type: 'text',
            text: JSON.stringify(result, null, 2)
          }]
        }
      }

      case 'extract_labs_from_text': {
        // Import intelligent OCR engine
        const { extractHybrid, extractWithPatterns, extractWithLLM } = await import('../engines/intelligentOCR')
        
        // Extract args
        const { ocr_text, marker_catalogue, extraction_mode = 'hybrid' } = args
        
        // Validate required fields
        if (!ocr_text || typeof ocr_text !== 'string') {
          throw new Error('Missing or invalid required field: ocr_text (must be string)')
        }
        
        // Extract based on mode
        let result: any
        
        if (extraction_mode === 'pattern') {
          const extractions = extractWithPatterns(ocr_text)
          result = {
            extractions,
            overall_confidence: extractions.length > 0 ? 'high' : 'low',
            extraction_method: 'patterns only',
            manual_review_needed: extractions.length === 0,
            suggestions: extractions.length === 0 ? ['No markers detected using patterns. Try hybrid mode.'] : []
          }
        } else if (extraction_mode === 'llm') {
          try {
            const extractions = await extractWithLLM(ocr_text, marker_catalogue)
            result = {
              extractions,
              overall_confidence: extractions.length > 0 ? 'high' : 'low',
              extraction_method: 'LLM only',
              manual_review_needed: extractions.filter((e: any) => e.confidence === 'low').length > 0,
              suggestions: []
            }
          } catch (error: any) {
            throw new Error(`LLM extraction failed: ${error.message}`)
          }
        } else {
          // Hybrid mode (default)
          result = await extractHybrid(ocr_text, marker_catalogue)
        }
        
        return {
          content: [{
            type: 'text',
            text: JSON.stringify(result, null, 2)
          }]
        }
      }
      
      case 'parse_apple_health_export': {
        // Import Apple Health parser
        const { parseAppleHealthExportZIP, parseAppleHealthXML } = await import('../engines/appleHealthParser')
        
        // Extract args
        const { export_data, data_type = 'zip_base64', aggregation = 'daily', date_range } = args
        
        // Validate required fields
        if (!export_data || typeof export_data !== 'string') {
          throw new Error('Missing or invalid required field: export_data (must be string)')
        }
        
        // Parse based on data type
        let timeline: any
        
        try {
          if (data_type === 'xml') {
            // Direct XML content
            timeline = await parseAppleHealthXML(export_data)
          } else {
            // Base64 encoded ZIP
            const zipBuffer = Buffer.from(export_data, 'base64')
            timeline = await parseAppleHealthExportZIP(zipBuffer.buffer)
          }
          
          // Filter by date range if provided
          if (date_range && (date_range.start_date || date_range.end_date)) {
            timeline = filterTimelineByDateRange(timeline, date_range.start_date, date_range.end_date)
          }
          
          // Format result
          const result = {
            success: true,
            timeline,
            summary: {
              profile: timeline.profile,
              date_range: timeline.metadata.date_range,
              total_records: timeline.metadata.record_count,
              metrics_available: Object.keys(timeline.daily_metrics)
                .filter(key => timeline.daily_metrics[key].length > 0),
              sleep_sessions_count: timeline.sleep_sessions.length,
              workouts_count: timeline.workouts.length
            },
            _meta: {
              aggregation,
              parser_version: '1.0.0',
              parsed_at: new Date().toISOString()
            }
          }
          
          return {
            content: [{
              type: 'text',
              text: JSON.stringify(result, null, 2)
            }]
          }
        } catch (error: any) {
          throw new Error(`Apple Health parsing failed: ${error.message}`)
        }
      }

      case 'analyze_correlations': {
        const { timeline, metrics_of_interest } = args
        
        if (!timeline) {
          throw new Error('Missing required field: timeline')
        }
        
        try {
          const analysis = analyzeCorrelations(
            timeline as HealthTimeline,
            metrics_of_interest
          )
          
          const result = {
            summary: 'Statistical Correlation Analysis',
            timestamp: new Date().toISOString(),
            analysis,
            _meta: {
              method: 'Pearson correlation with t-test significance',
              significance_threshold: 'p < 0.05',
              minimum_data_points: 3
            }
          }
          
          return {
            content: [{
              type: 'text',
              text: JSON.stringify(result, null, 2)
            }]
          }
        } catch (error: any) {
          throw new Error(`Correlation analysis failed: ${error.message}`)
        }
      }

      case 'get_timeline_data': {
        const { timeline, metrics, time_window, aggregation } = args
        
        if (!timeline || !metrics) {
          throw new Error('Missing required fields: timeline and metrics')
        }
        
        try {
          const queryResult = queryTimelineData(
            timeline as HealthTimeline,
            { metrics, time_window, aggregation }
          )
          
          const result = {
            summary: 'Timeline Data Query',
            timestamp: new Date().toISOString(),
            data: queryResult,
            _meta: {
              query_type: 'time_series',
              time_window,
              aggregation: aggregation || 'daily'
            }
          }
          
          return {
            content: [{
              type: 'text',
              text: JSON.stringify(result, null, 2)
            }]
          }
        } catch (error: any) {
          throw new Error(`Timeline query failed: ${error.message}`)
        }
      }

      case 'generate_timeline_export': {
        const { timeline, format, include_labs, include_vitals, include_wearables, metrics } = args
        
        if (!timeline || !format) {
          throw new Error('Missing required fields: timeline and format')
        }
        
        try {
          const exportResult = exportTimeline(
            timeline as HealthTimeline,
            {
              format,
              metrics,
              include_labs,
              include_vitals,
              include_wearables
            }
          )
          
          const result = {
            summary: 'Timeline Export Generated',
            timestamp: new Date().toISOString(),
            export: exportResult,
            download_link: `data:text/${format === 'json' ? 'json' : 'csv'};charset=utf-8,${encodeURIComponent(exportResult.data)}`,
            _meta: {
              format,
              total_rows: exportResult.row_count,
              total_columns: exportResult.column_count
            }
          }
          
          return {
            content: [{
              type: 'text',
              text: JSON.stringify(result, null, 2)
            }]
          }
        } catch (error: any) {
          throw new Error(`Timeline export failed: ${error.message}`)
        }
      }
      
      // ============================================================================
      // TIER 1: DETERMINISTIC BIOMARKER PREDICTIONS (10 atomic MCPs)
      // ============================================================================
      
      case 'calculate_apob': {
        const { calculate_apob } = await import('../models/deterministic');
        try {
          const result = calculate_apob(args);
          return {
            content: [{
              type: 'text',
              text: JSON.stringify(result, null, 2)
            }]
          };
        } catch (error: any) {
          throw new Error(`apoB calculation failed: ${error.message}`);
        }
      }
      
      case 'calculate_non_hdl': {
        const { calculate_non_hdl } = await import('../models/deterministic');
        try {
          const result = calculate_non_hdl(args);
          return {
            content: [{
              type: 'text',
              text: JSON.stringify(result, null, 2)
            }]
          };
        } catch (error: any) {
          throw new Error(`Non-HDL calculation failed: ${error.message}`);
        }
      }
      
      case 'calculate_sdldl_pattern': {
        const { calculate_sdldl_pattern } = await import('../models/deterministic');
        try {
          const result = calculate_sdldl_pattern(args);
          return {
            content: [{
              type: 'text',
              text: JSON.stringify(result, null, 2)
            }]
          };
        } catch (error: any) {
          throw new Error(`sdLDL pattern calculation failed: ${error.message}`);
        }
      }
      
      case 'calculate_tg_hdl_ratio': {
        const { calculate_tg_hdl_ratio } = await import('../models/deterministic');
        try {
          const result = calculate_tg_hdl_ratio(args);
          return {
            content: [{
              type: 'text',
              text: JSON.stringify(result, null, 2)
            }]
          };
        } catch (error: any) {
          throw new Error(`TG/HDL ratio calculation failed: ${error.message}`);
        }
      }
      
      case 'calculate_tc_hdl_ratio': {
        const { calculate_tc_hdl_ratio } = await import('../models/deterministic');
        try {
          const result = calculate_tc_hdl_ratio(args);
          return {
            content: [{
              type: 'text',
              text: JSON.stringify(result, null, 2)
            }]
          };
        } catch (error: any) {
          throw new Error(`TC/HDL ratio calculation failed: ${error.message}`);
        }
      }
      
      case 'calculate_homa_ir': {
        const { calculate_homa_ir } = await import('../models/deterministic');
        try {
          const result = calculate_homa_ir(args);
          return {
            content: [{
              type: 'text',
              text: JSON.stringify(result, null, 2)
            }]
          };
        } catch (error: any) {
          throw new Error(`HOMA-IR calculation failed: ${error.message}`);
        }
      }
      
      case 'estimate_hba1c_from_glucose': {
        const { estimate_hba1c_from_glucose } = await import('../models/deterministic');
        try {
          const result = estimate_hba1c_from_glucose(args);
          return {
            content: [{
              type: 'text',
              text: JSON.stringify(result, null, 2)
            }]
          };
        } catch (error: any) {
          throw new Error(`HbA1c estimation failed: ${error.message}`);
        }
      }
      
      case 'estimate_homa_ir_from_lipids': {
        const { estimate_homa_ir_from_lipids } = await import('../models/deterministic');
        try {
          const result = estimate_homa_ir_from_lipids(args);
          return {
            content: [{
              type: 'text',
              text: JSON.stringify(result, null, 2)
            }]
          };
        } catch (error: any) {
          throw new Error(`HOMA-IR estimation failed: ${error.message}`);
        }
      }
      
      case 'calculate_fib4': {
        const { calculate_fib4 } = await import('../models/deterministic');
        try {
          const result = calculate_fib4(args);
          return {
            content: [{
              type: 'text',
              text: JSON.stringify(result, null, 2)
            }]
          };
        } catch (error: any) {
          throw new Error(`FIB-4 calculation failed: ${error.message}`);
        }
      }
      
      case 'calculate_egfr_ckd_epi': {
        const { calculate_egfr_ckd_epi } = await import('../models/deterministic');
        try {
          const result = calculate_egfr_ckd_epi(args);
          return {
            content: [{
              type: 'text',
              text: JSON.stringify(result, null, 2)
            }]
          };
        } catch (error: any) {
          throw new Error(`eGFR calculation failed: ${error.message}`);
        }
      }
      
      case 'calculate_bun_creatinine_ratio': {
        const { calculate_bun_creatinine_ratio } = await import('../models/deterministic');
        try {
          const result = calculate_bun_creatinine_ratio(args);
          return {
            content: [{
              type: 'text',
              text: JSON.stringify(result, null, 2)
            }]
          };
        } catch (error: any) {
          throw new Error(`BUN/Creatinine ratio calculation failed: ${error.message}`);
        }
      }
      
      case 'calculate_ast_alt_ratio': {
        const { calculate_ast_alt_ratio } = await import('../models/deterministic');
        try {
          const result = calculate_ast_alt_ratio(args);
          return {
            content: [{
              type: 'text',
              text: JSON.stringify(result, null, 2)
            }]
          };
        } catch (error: any) {
          throw new Error(`AST/ALT ratio calculation failed: ${error.message}`);
        }
      }
      
      default:
        throw new Error(`Unknown tool: ${toolName}`)
    }
  } catch (error: any) {
    return {
      content: [{
        type: 'text',
        text: `Error executing tool: ${error.message}`
      }],
      isError: true
    }
  }
}

function formatRiskScoresForMCP(results: any): any {
  const formatted: any = {}

  if (results.ascvd10y && !results.ascvd10y.error) {
    formatted.cardiovascular = {
      test: 'ASCVD 10-Year Risk',
      value: `${results.ascvd10y.percentage}%`,
      category: results.ascvd10y.category.toUpperCase(),
      interpretation: getASCVDInterpretation(results.ascvd10y.category),
      recommendation: getASCVDRecommendation(results.ascvd10y.category)
    }
  }

  if (results.fib4 && !results.fib4.error) {
    formatted.liver_fibrosis = {
      test: 'FIB-4 Score',
      value: results.fib4.score,
      category: results.fib4.category.toUpperCase(),
      interpretation: getFIB4Interpretation(results.fib4.category)
    }
  }

  if (results.egfr && !results.egfr.error) {
    formatted.kidney_function = {
      test: 'eGFR (CKD-EPI 2021)',
      value: `${results.egfr.score} mL/min/1.73m²`,
      stage: results.egfr.stage,
      description: results.egfr.stageInfo.description,
      range: results.egfr.stageInfo.egfrRange
    }
  }

  if (results.homaIr && !results.homaIr.error) {
    formatted.insulin_resistance = {
      test: 'HOMA-IR',
      value: results.homaIr.score,
      category: results.homaIr.category.toUpperCase().replace('_', ' '),
      quicki: results.homaIr.quicki,
      interpretation: getHOMAIRInterpretation(results.homaIr.category)
    }
  }

  if (results.nafld && !results.nafld.error) {
    formatted.nafld = {
      test: 'NAFLD Fibrosis Score',
      value: results.nafld.score,
      category: results.nafld.category.toUpperCase(),
      interpretation: getNAFLDInterpretation(results.nafld.category)
    }
  }

  return formatted
}

function getASCVDInterpretation(category: string): string {
  const interpretations: Record<string, string> = {
    low: 'Low risk (<5%): Lifestyle modifications recommended',
    borderline: 'Borderline risk (5-7.5%): Consider statin therapy in select patients',
    intermediate: 'Intermediate risk (7.5-20%): Statin therapy recommended',
    high: 'High risk (≥20%): High-intensity statin therapy recommended'
  }
  return interpretations[category] || 'Risk assessment completed'
}

function getASCVDRecommendation(category: string): string {
  const recommendations: Record<string, string> = {
    low: 'Continue healthy lifestyle, regular monitoring',
    borderline: 'Consider risk discussion with healthcare provider, assess additional risk factors',
    intermediate: 'Consult healthcare provider for statin therapy consideration',
    high: 'Urgent consultation recommended for aggressive risk reduction therapy'
  }
  return recommendations[category] || 'Consult healthcare provider'
}

function getFIB4Interpretation(category: string): string {
  const interpretations: Record<string, string> = {
    low: 'Low probability of advanced liver fibrosis (score <1.3)',
    indeterminate: 'Indeterminate result (1.3-2.67): Further evaluation recommended',
    high: 'High probability of advanced liver fibrosis (>2.67): Specialist referral advised'
  }
  return interpretations[category] || 'Liver fibrosis assessment completed'
}

function getHOMAIRInterpretation(category: string): string {
  const interpretations: Record<string, string> = {
    insulin_sensitive: 'Insulin sensitive (<1.0): Optimal insulin function',
    borderline: 'Borderline insulin resistance (1.0-2.0): Monitor and consider lifestyle modifications',
    insulin_resistant: 'Insulin resistant (>2.0): Significant insulin resistance detected'
  }
  return interpretations[category] || 'Insulin resistance assessment completed'
}

function getNAFLDInterpretation(category: string): string {
  const interpretations: Record<string, string> = {
    low: 'Low risk of NAFLD-related fibrosis (score <-1.455)',
    indeterminate: 'Indeterminate risk (-1.455 to 0.676): Additional testing may be needed',
    high: 'High risk of NAFLD-related fibrosis (>0.676): Further evaluation recommended'
  }
  return interpretations[category] || 'NAFLD assessment completed'
}

function getCalculatorInfo(calculator: string): any {
  const allCalculators = {
    ascvd: {
      name: 'ASCVD 10-Year Risk',
      fullName: 'Pooled Cohort Equations (2013 ACC/AHA)',
      purpose: 'Estimate 10-year risk of atherosclerotic cardiovascular disease',
      inputs: ['age (20-79 years)', 'sex', 'race', 'total cholesterol', 'HDL cholesterol', 'systolic BP', 'smoking status', 'diabetes status', 'BP medication use'],
      categories: {
        low: '<5% - Lifestyle modifications',
        borderline: '5-7.5% - Consider statin in select patients',
        intermediate: '7.5-20% - Statin therapy recommended',
        high: '≥20% - High-intensity statin therapy'
      },
      reference: 'Goff DC Jr, et al. Circulation. 2014;129(25 Suppl 2):S49-73'
    },
    fib4: {
      name: 'FIB-4 Score',
      fullName: 'FIB-4 Index for Liver Fibrosis',
      purpose: 'Assess probability of advanced liver fibrosis',
      inputs: ['age', 'AST', 'ALT', 'platelet count'],
      categories: {
        low: '<1.3 - Low probability of advanced fibrosis',
        indeterminate: '1.3-2.67 - Further evaluation needed',
        high: '>2.67 - High probability of advanced fibrosis'
      },
      note: 'For age >65, consider cutoff of 2.0 instead of 1.3',
      reference: 'Sterling RK, et al. Hepatology. 2006;43(6):1317-1325'
    },
    nafld: {
      name: 'NAFLD Fibrosis Score',
      fullName: 'Non-Alcoholic Fatty Liver Disease Fibrosis Score',
      purpose: 'Assess fibrosis risk in NAFLD patients',
      inputs: ['age', 'BMI', 'diabetes/impaired fasting glucose', 'AST', 'ALT', 'platelet count', 'albumin'],
      categories: {
        low: '<-1.455 - Low risk of advanced fibrosis',
        indeterminate: '-1.455 to 0.676 - Indeterminate',
        high: '>0.676 - High risk of advanced fibrosis'
      },
      reference: 'Angulo P, et al. Hepatology. 2007;45(4):846-854'
    },
    egfr: {
      name: 'eGFR (CKD-EPI 2021)',
      fullName: 'Estimated Glomerular Filtration Rate (race-free)',
      purpose: 'Estimate kidney function',
      inputs: ['serum creatinine', 'age', 'sex'],
      note: 'Race-free equation introduced in 2021',
      reference: 'Inker LA, et al. N Engl J Med. 2021;385(19):1737-1749'
    },
    ckd: {
      name: 'CKD Staging',
      fullName: 'Chronic Kidney Disease Staging',
      purpose: 'Classify severity of kidney disease',
      stages: {
        G1: '≥90 mL/min/1.73m² - Normal or high (with kidney damage)',
        G2: '60-89 - Mildly decreased',
        G3a: '45-59 - Mild to moderate decrease',
        G3b: '30-44 - Moderate to severe decrease',
        G4: '15-29 - Severe decrease',
        G5: '<15 - Kidney failure'
      }
    },
    homa_ir: {
      name: 'HOMA-IR',
      fullName: 'Homeostatic Model Assessment for Insulin Resistance',
      purpose: 'Assess insulin resistance and beta-cell function',
      inputs: ['fasting glucose (mg/dL)', 'fasting insulin (μU/mL)'],
      categories: {
        insulin_sensitive: '<1.0 - Optimal insulin sensitivity',
        borderline: '1.0-2.0 - Borderline insulin resistance',
        insulin_resistant: '>2.0 - Insulin resistant'
      },
      note: 'Cutoffs vary by population; these are conservative estimates',
      reference: 'Matthews DR, et al. Diabetologia. 1985;28(7):412-419'
    }
  }

  if (calculator === 'all') {
    return allCalculators
  }

  return allCalculators[calculator as keyof typeof allCalculators] || { error: 'Calculator not found' }
}
