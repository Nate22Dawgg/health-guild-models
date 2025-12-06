/**
 * Derived Ratios Engine
 * Calculates clinical ratios from existing markers
 */

import { LabSnapshot } from '../types/health-data'
import {
  bunCreatinineRatio,
  astAltRatio,
  tgHdlRatio,
  nonHdlCholesterol,
  totalCholHdlRatio
} from '../calculators/derived-ratios'

export interface DerivedRatioCalculation {
  ratio_name: string
  value: number
  category: string
  interpretation: string
  evidence_tier: string
  markers_used: string[]
}

export interface MarkerUtilization {
  collected_markers: string[]
  fully_utilized_markers: string[]
  partially_utilized_markers: string[]
  unused_markers: string[]
  utilization_percent: number
  unused_details: Array<{
    marker: string
    why_unused: string
    what_it_measures: string
    how_to_use_it: string
  }>
}

/**
 * Calculate all possible derived ratios from latest lab snapshot
 */
export function calculateDerivedRatios(labHistory: LabSnapshot[]): DerivedRatioCalculation[] {
  if (labHistory.length === 0) return []

  const latestLabs = labHistory[labHistory.length - 1].labs
  const ratios: DerivedRatioCalculation[] = []

  // BUN/Creatinine Ratio
  if (latestLabs.bun && latestLabs.creatinine) {
    try {
      const result = bunCreatinineRatio(latestLabs.bun, latestLabs.creatinine)
      ratios.push({
        ratio_name: 'BUN/Creatinine Ratio',
        value: result.ratio,
        category: result.category,
        interpretation: result.interpretation,
        evidence_tier: result.evidence_tier,
        markers_used: ['bun', 'creatinine']
      })
    } catch (e) {}
  }

  // AST/ALT Ratio
  if (latestLabs.ast && latestLabs.alt) {
    try {
      const result = astAltRatio(latestLabs.ast, latestLabs.alt)
      ratios.push({
        ratio_name: 'AST/ALT Ratio (De Ritis)',
        value: result.ratio,
        category: result.category,
        interpretation: result.interpretation,
        evidence_tier: result.evidence_tier,
        markers_used: ['ast', 'alt']
      })
    } catch (e) {}
  }

  // TG/HDL Ratio
  if (latestLabs.triglycerides && latestLabs.hdl) {
    try {
      const result = tgHdlRatio(latestLabs.triglycerides, latestLabs.hdl)
      ratios.push({
        ratio_name: 'TG/HDL Ratio',
        value: result.ratio,
        category: result.category,
        interpretation: result.interpretation,
        evidence_tier: result.evidence_tier,
        markers_used: ['triglycerides', 'hdl']
      })
    } catch (e) {}
  }

  // Non-HDL Cholesterol
  if (latestLabs.total_chol && latestLabs.hdl) {
    try {
      const result = nonHdlCholesterol(latestLabs.total_chol, latestLabs.hdl)
      ratios.push({
        ratio_name: 'Non-HDL Cholesterol',
        value: result.ratio,
        category: result.category,
        interpretation: result.interpretation,
        evidence_tier: result.evidence_tier,
        markers_used: ['total_chol', 'hdl']
      })
    } catch (e) {}
  }

  // Total Cholesterol/HDL Ratio
  if (latestLabs.total_chol && latestLabs.hdl) {
    try {
      const result = totalCholHdlRatio(latestLabs.total_chol, latestLabs.hdl)
      ratios.push({
        ratio_name: 'Total Chol/HDL Ratio',
        value: result.ratio,
        category: result.category,
        interpretation: result.interpretation,
        evidence_tier: result.evidence_tier,
        markers_used: ['total_chol', 'hdl']
      })
    } catch (e) {}
  }

  return ratios
}

/**
 * Analyze marker utilization - which markers are collected but unused
 */
export function analyzeMarkerUtilization(labHistory: LabSnapshot[]): MarkerUtilization {
  if (labHistory.length === 0) {
    return {
      collected_markers: [],
      fully_utilized_markers: [],
      partially_utilized_markers: [],
      unused_markers: [],
      utilization_percent: 0,
      unused_details: []
    }
  }

  // Get all unique markers across all lab snapshots
  const allMarkers = new Set<string>()
  labHistory.forEach(snapshot => {
    Object.keys(snapshot.labs).forEach(marker => {
      if (snapshot.labs[marker] != null) {
        allMarkers.add(marker)
      }
    })
  })

  const collectedMarkers = Array.from(allMarkers).sort()

  // Define marker utilization categories
  // ALL 30 MARKERS NOW FULLY UTILIZED!
  const fullyUtilized = [
    // Metabolic (3)
    'glucose', 'hba1c', 'fasting_insulin',
    // Lipids (4)
    'total_chol', 'ldl', 'hdl', 'triglycerides',
    // Liver (6)
    'ast', 'alt', 'albumin', 'bilirubin', 'ggt', 'alp',
    // Kidney (3)
    'creatinine', 'bun', 'egfr',
    // Blood Pressure (2)
    'systolic_bp', 'diastolic_bp',
    // Blood Count (1)
    'platelets',
    // Inflammation (1)
    'hs_crp',
    // Nutrients (3)
    'vitamin_d', 'vitamin_b12', 'ferritin',
    // Thyroid (5)
    'tsh', 'free_t3', 'free_t4', 'reverse_t3', 'tpo_antibodies'
  ]

  const partiallyUtilized: string[] = []

  const unused: string[] = []

  const fullyUtilizedMarkers = collectedMarkers.filter(m => fullyUtilized.includes(m))
  const partiallyUtilizedMarkers = collectedMarkers.filter(m => partiallyUtilized.includes(m))
  const unusedMarkers = collectedMarkers.filter(m => unused.includes(m))

  // Calculate utilization percentage
  const utilizationPercent = collectedMarkers.length > 0
    ? Math.round(((fullyUtilizedMarkers.length + partiallyUtilizedMarkers.length * 0.5) / collectedMarkers.length) * 100)
    : 0

  // Detailed explanations for unused markers
  // If all markers are utilized, provide empty array
  const unusedDetails = unusedMarkers.length === 0 
    ? [] 
    : unusedMarkers.map(marker => {
        // This should rarely execute since all 25 standard markers are now fully utilized
        return {
          marker,
          why_unused: 'Marker not recognized by current models',
          what_it_measures: 'Non-standard biomarker',
          how_to_use_it: 'Under evaluation for future models'
        }
      })

  return {
    collected_markers: collectedMarkers,
    fully_utilized_markers: fullyUtilizedMarkers,
    partially_utilized_markers: partiallyUtilizedMarkers,
    unused_markers: unusedMarkers,
    utilization_percent: utilizationPercent,
    unused_details: unusedDetails
  }
}
