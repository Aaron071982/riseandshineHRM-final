import type {
  AflsPresentLevel,
  AflsProtocol,
  AflsSkill,
  AflsSkillArea,
  AflsSummaryScore,
  Instruments,
  SkillsAssessmentType,
} from '@/lib/crm/assessment/assessment.schema'

export const SKILLS_ASSESSMENT_TYPE_LABELS: Record<SkillsAssessmentType, string> = {
  AFLS: 'AFLS',
  ATEC: 'ATEC',
  OTHER: 'Other',
}

export const AFLS_SCORE_OPTIONS = ['0', '1', '2', '3', '4', 'N/A'] as const

export function isLikelyLegacyAflsText(text: string | null | undefined): boolean {
  return /\bAFLS\b/i.test(text ?? '')
}

export function hasLegacyAtecData(
  instruments: Pick<Instruments, 'atecAssessment'>,
  interpretation: string | null | undefined,
  attachmentCount = 0
): boolean {
  return Boolean(
    instruments.atecAssessment?.trim() ||
      interpretation?.trim() ||
      attachmentCount > 0
  )
}

export function normalizeSkillsAssessmentType(input: {
  rawType: unknown
  atecAssessment: string
  aflsAssessment: string
  atecInterpretation: string
}): SkillsAssessmentType {
  if (input.rawType === 'AFLS' || input.rawType === 'ATEC' || input.rawType === 'OTHER') {
    return input.rawType
  }
  const joined = [input.atecAssessment, input.atecInterpretation].join('\n')
  if (isLikelyLegacyAflsText(joined)) return 'AFLS'
  if (input.atecAssessment.trim() || input.atecInterpretation.trim()) return 'ATEC'
  if (input.aflsAssessment.trim()) return 'AFLS'
  return 'AFLS'
}

export function selectedSkillsAssessmentLabel(instruments: Pick<
  Instruments,
  'skillsAssessmentType' | 'otherSkillsAssessmentLabel'
>): string {
  if (instruments.skillsAssessmentType === 'OTHER') {
    return instruments.otherSkillsAssessmentLabel?.trim() || 'Other skills assessment'
  }
  return SKILLS_ASSESSMENT_TYPE_LABELS[instruments.skillsAssessmentType]
}

export function scoreDateSort(a: string, b: string): number {
  if (!a && !b) return 0
  if (!a) return 1
  if (!b) return -1
  return a.localeCompare(b)
}

export function getOrderedAflsDates(afls: AflsPresentLevel): string[] {
  const dates = new Set<string>()
  for (const protocol of afls.protocols) {
    for (const point of protocol.summaryScores) {
      if (point.date.trim()) dates.add(point.date.trim())
    }
    for (const area of protocol.skillAreas) {
      for (const point of area.summaryScores) {
        if (point.date.trim()) dates.add(point.date.trim())
      }
      for (const skill of area.skills) {
        for (const point of skill.scores) {
          if (point.date.trim()) dates.add(point.date.trim())
        }
      }
    }
  }
  return [...dates].sort(scoreDateSort)
}

export function setAflsSkillScoreDateColumns(
  afls: AflsPresentLevel,
  dates: string[]
): AflsPresentLevel {
  return {
    ...afls,
    protocols: afls.protocols.map((protocol) => ({
      ...protocol,
      skillAreas: protocol.skillAreas.map((area) => ({
        ...area,
        skills: area.skills.map((skill) => ({
          ...skill,
          scores: dates.map((date) => {
            const existing = skill.scores.find((score) => score.date === date)
            return existing ?? { id: crypto.randomUUID(), date, value: null }
          }),
        })),
      })),
    })),
  }
}

function latestSummaryValue(points: AflsSummaryScore[]): number | null {
  const sorted = [...points]
    .filter((point) => point.value != null)
    .sort((a, b) => scoreDateSort(a.date, b.date))
  return sorted.length ? (sorted[sorted.length - 1].value ?? null) : null
}

export function aflsLatestProtocolValue(protocol: AflsProtocol): number | null {
  const explicit = latestSummaryValue(protocol.summaryScores)
  if (explicit != null) return explicit
  const areaValues = protocol.skillAreas
    .map((area) => aflsLatestSkillAreaValue(area))
    .filter((value): value is number => value != null)
  if (!areaValues.length) return null
  return Math.round((areaValues.reduce((sum, value) => sum + value, 0) / areaValues.length) * 100) / 100
}

export function aflsLatestSkillAreaValue(area: AflsSkillArea): number | null {
  const explicit = latestSummaryValue(area.summaryScores)
  if (explicit != null) return explicit
  const skillValues = area.skills
    .map((skill) => aflsLatestSkillValue(skill))
    .filter((value): value is number => value != null)
  if (!skillValues.length) return null
  return Math.round((skillValues.reduce((sum, value) => sum + value, 0) / skillValues.length) * 100) / 100
}

export function aflsLatestSkillValue(skill: AflsSkill): number | null {
  const sorted = [...skill.scores].sort((a, b) => scoreDateSort(a.date, b.date))
  for (let index = sorted.length - 1; index >= 0; index -= 1) {
    const value = sorted[index]?.value
    if (typeof value === 'number') return value
  }
  return null
}
