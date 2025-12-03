/**
 * Health Index Engine
 * Calculates overall health index (0-100) from domain scores
 */

import { DomainScore } from '../types/health-data'

// Domain weights for overall health index
const DOMAIN_WEIGHTS: Record<string, number> = {
  metabolic: 0.25,
  lipid: 0.20,
  kidney: 0.20,
  liver: 0.15,
  inflammation: 0.10,
  nutrient: 0.10,
  cardiorespiratory: 0.05,
}

/**
 * Calculate overall health index from domain scores
 */
export function calculateHealthIndex(domainScores: DomainScore[]): {
  overall_health_index: number | null
  strongest_domain: string | null
  weakest_domain: string | null
  narrative: string
} {
  if (domainScores.length === 0) {
    return {
      overall_health_index: null,
      strongest_domain: null,
      weakest_domain: null,
      narrative: "Insufficient data to calculate overall health index. Add lab results to get your personalized health score."
    }
  }

  // Calculate weighted average
  let totalWeightedScore = 0
  let totalWeight = 0

  domainScores.forEach(domain => {
    const weight = DOMAIN_WEIGHTS[domain.domain] || 0.05
    totalWeightedScore += domain.score * weight
    totalWeight += weight
  })

  const overallScore = totalWeight > 0 
    ? Math.round(totalWeightedScore / totalWeight) 
    : null

  // Find strongest and weakest domains
  let strongest: DomainScore | null = null
  let weakest: DomainScore | null = null

  domainScores.forEach(domain => {
    if (!strongest || domain.score > strongest.score) {
      strongest = domain
    }
    if (!weakest || domain.score < weakest.score) {
      weakest = domain
    }
  })

  // Generate narrative
  const narrative = generateNarrative(overallScore, strongest, weakest, domainScores)

  return {
    overall_health_index: overallScore,
    strongest_domain: strongest?.domain || null,
    weakest_domain: weakest?.domain || null,
    narrative
  }
}

/**
 * Generate human-readable narrative about health status
 */
function generateNarrative(
  overallScore: number | null,
  strongest: DomainScore | null,
  weakest: DomainScore | null,
  allDomains: DomainScore[]
): string {
  if (overallScore === null) {
    return "Unable to calculate health index with available data."
  }

  let narrative = ""

  // Overall assessment
  if (overallScore >= 80) {
    narrative += `Your overall health index is ${overallScore}/100, indicating strong health across multiple domains.`
  } else if (overallScore >= 65) {
    narrative += `Your overall health index is ${overallScore}/100, showing good health with room for optimization.`
  } else if (overallScore >= 50) {
    narrative += `Your overall health index is ${overallScore}/100, suggesting some areas could benefit from attention.`
  } else {
    narrative += `Your overall health index is ${overallScore}/100. Several areas may benefit from discussion with your healthcare provider.`
  }

  // Strongest domain
  if (strongest) {
    narrative += ` Your ${strongest.domain} health is particularly strong (${strongest.score}/100).`
  }

  // Weakest domain (if significantly lower)
  if (weakest && strongest && weakest.score < strongest.score - 20) {
    narrative += ` Your ${weakest.domain} domain shows the most opportunity for improvement (${weakest.score}/100).`
  }

  return narrative
}

/**
 * Get health index category/badge
 */
export function getHealthIndexBadge(score: number | null): {
  label: string
  color: string
  emoji: string
} {
  if (score === null) {
    return {
      label: "Incomplete",
      color: "gray",
      emoji: "📊"
    }
  }

  if (score >= 85) {
    return {
      label: "Excellent",
      color: "green",
      emoji: "🌟"
    }
  } else if (score >= 70) {
    return {
      label: "Good",
      color: "blue",
      emoji: "💪"
    }
  } else if (score >= 55) {
    return {
      label: "Fair",
      color: "yellow",
      emoji: "⚠️"
    }
  } else {
    return {
      label: "Needs Attention",
      color: "red",
      emoji: "🔍"
    }
  }
}
