/**
 * Interview scorecard categories and validation.
 * Used by API (validation) and UI (labels + order).
 */

export const SCORECARD_CATEGORIES = [
  'communication',
  'adaptability',
  'professionalism',
  'empathy_rapport',
  'ABA_basics',
  'documentation_accuracy',
  'reliability',
  'availability_fit',
] as const

export type ScorecardCategory = (typeof SCORECARD_CATEGORIES)[number]

export const SCORECARD_CATEGORY_LABELS: Record<ScorecardCategory, string> = {
  communication: 'Communication',
  adaptability: 'Adaptability',
  professionalism: 'Professionalism',
  empathy_rapport: 'Empathy & rapport (with client/parent)',
  ABA_basics: 'ABA basics',
  documentation_accuracy: 'Documentation accuracy',
  reliability: 'Reliability',
  availability_fit: 'Availability fit',
}

const categorySet = new Set<string>(SCORECARD_CATEGORIES)

export function isScorecardCategory(key: string): key is ScorecardCategory {
  return categorySet.has(key)
}

export function isValidScore(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= 1 && value <= 5
}

export function computeOverallScore(scores: Record<string, number>): {
  overallScore: number
  ratedCount: number
} {
  const values = Object.values(scores).filter((v) => typeof v === 'number' && v >= 1 && v <= 5)
  if (values.length === 0) return { overallScore: 0, ratedCount: 0 }
  const sum = values.reduce((a, b) => a + b, 0)
  return {
    overallScore: Math.round((sum / values.length) * 10) / 10,
    ratedCount: values.length,
  }
}
