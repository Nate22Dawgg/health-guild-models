/**
 * Trend Analysis Engine
 * Analyzes time-series health data to detect trends and slopes
 */

import { LabSnapshot, MarkerTrend } from '../types/health-data'

interface DataPoint {
  date: Date
  value: number
}

/**
 * Calculate slope (rate of change per year) using linear regression
 */
function calculateSlope(points: DataPoint[]): number | null {
  if (points.length < 2) return null

  // Convert dates to years from first point
  const baseDate = points[0].date.getTime()
  const yearsFromStart = points.map(p => 
    (p.date.getTime() - baseDate) / (1000 * 60 * 60 * 24 * 365.25)
  )
  
  const values = points.map(p => p.value)
  
  // Calculate means
  const n = points.length
  const meanX = yearsFromStart.reduce((a, b) => a + b, 0) / n
  const meanY = values.reduce((a, b) => a + b, 0) / n
  
  // Calculate slope (β)
  let numerator = 0
  let denominator = 0
  
  for (let i = 0; i < n; i++) {
    numerator += (yearsFromStart[i] - meanX) * (values[i] - meanY)
    denominator += Math.pow(yearsFromStart[i] - meanX, 2)
  }
  
  if (denominator === 0) return null
  
  return numerator / denominator
}

/**
 * Calculate z-score (standard deviations from mean)
 */
function calculateZScore(value: number, values: number[]): number | null {
  if (values.length < 2) return null
  
  const mean = values.reduce((a, b) => a + b, 0) / values.length
  const variance = values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / values.length
  const stdDev = Math.sqrt(variance)
  
  if (stdDev === 0) return null
  
  return (value - mean) / stdDev
}

/**
 * Classify trend direction based on slope and significance
 */
function classifyTrend(
  slope: number | null, 
  pointCount: number,
  markerType: string
): "improving" | "worsening" | "stable" | "insufficient_data" {
  if (slope === null || pointCount < 2) {
    return "insufficient_data"
  }
  
  // Thresholds vary by marker - using conservative defaults
  const threshold = 0.1 // 10% of typical values per year
  
  // Determine if higher is better or worse
  const higherIsBetter = ["hdl", "egfr", "vitamin_d", "vitamin_b12"].includes(markerType.toLowerCase())
  const lowerIsBetter = [
    "glucose", "hba1c", "total_chol", "ldl", "triglycerides", 
    "ast", "alt", "creatinine", "systolic_bp", "diastolic_bp",
    "hs_crp", "weight_kg"
  ].includes(markerType.toLowerCase())
  
  if (Math.abs(slope) < threshold) {
    return "stable"
  }
  
  if (higherIsBetter) {
    return slope > 0 ? "improving" : "worsening"
  } else if (lowerIsBetter) {
    return slope < 0 ? "improving" : "worsening"
  } else {
    // Unknown marker direction
    return "stable"
  }
}

/**
 * Generate human-readable interpretation
 */
function generateInterpretation(
  marker: string,
  direction: string,
  slope: number | null,
  pointCount: number
): string {
  if (pointCount < 2) {
    return `Insufficient data to determine trend (only ${pointCount} measurement${pointCount === 1 ? '' : 's'}).`
  }
  
  if (slope === null || direction === "insufficient_data") {
    return "Unable to calculate trend with available data."
  }
  
  if (direction === "stable") {
    return `${marker} has remained relatively stable over time.`
  }
  
  const absSlope = Math.abs(slope).toFixed(2)
  const timeframe = pointCount >= 4 ? "over the measured period" : "based on limited data points"
  
  if (direction === "improving") {
    return `${marker} shows an improving trend (${absSlope} units/year) ${timeframe}.`
  } else {
    return `${marker} shows a worsening trend (${absSlope} units/year) ${timeframe}. Consider discussing with your healthcare provider.`
  }
}

/**
 * Analyze trends for all markers in lab history
 */
export function analyzeTrends(labHistory: LabSnapshot[]): MarkerTrend[] {
  if (labHistory.length === 0) {
    return []
  }

  // Sort by date
  const sorted = [...labHistory].sort((a, b) => 
    new Date(a.date).getTime() - new Date(b.date).getTime()
  )

  // Collect all unique markers
  const allMarkers = new Set<string>()
  sorted.forEach(snapshot => {
    Object.keys(snapshot.labs).forEach(marker => {
      if (snapshot.labs[marker] != null) {
        allMarkers.add(marker)
      }
    })
  })

  // Analyze each marker
  const trends: MarkerTrend[] = []

  allMarkers.forEach(marker => {
    // Collect all non-null values with dates
    const dataPoints: DataPoint[] = []
    
    sorted.forEach(snapshot => {
      const value = snapshot.labs[marker]
      if (value != null) {
        dataPoints.push({
          date: new Date(snapshot.date),
          value: value
        })
      }
    })

    if (dataPoints.length === 0) {
      return  // Skip markers with no data
    }

    // Get latest value and date
    const latest = dataPoints[dataPoints.length - 1]
    
    // Calculate slope
    const slope = calculateSlope(dataPoints)
    
    // Calculate z-score for latest value
    const allValues = dataPoints.map(p => p.value)
    const zScore = calculateZScore(latest.value, allValues)
    
    // Classify trend
    const direction = classifyTrend(slope, dataPoints.length, marker)
    
    // Generate interpretation
    const interpretation = generateInterpretation(
      marker, 
      direction, 
      slope, 
      dataPoints.length
    )

    trends.push({
      marker,
      latest_value: latest.value,
      latest_date: latest.date.toISOString().split('T')[0],
      slope_per_year: slope,
      direction,
      interpretation,
      z_score_latest: zScore
    })
  })

  return trends
}

/**
 * Get specific marker trend
 */
export function getMarkerTrend(
  labHistory: LabSnapshot[], 
  markerName: string
): MarkerTrend | null {
  const trends = analyzeTrends(labHistory)
  return trends.find(t => t.marker === markerName) || null
}
