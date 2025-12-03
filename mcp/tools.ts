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
  }
]

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
          recommendations,
          _meta: {
            format_version: '1.0.0',
            schema_url: 'https://health-guild-mcp.pages.dev/schemas/lab-history.json',
            data_points_analyzed: lab_history.length,
            date_range: {
              earliest: lab_history[0]?.date,
              latest: lab_history[lab_history.length - 1]?.date
            },
            unique_markers: trends.length
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
