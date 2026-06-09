import type { OnboardingCompletion, OnboardingDocument, RBTProfile } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import {
  ESIGN_CONSENT_SLUG,
  ONBOARDING_CATALOG,
  RBT_VISIBLE_STEPS,
  TIER_A_LAST_STEP,
  TIER_B_FIRST_STEP,
  TIER_B_LAST_STEP,
  TOTAL_ONBOARDING_STEPS,
  getRbtVisibleCatalog,
} from '@/lib/onboarding/catalog'

export type OnboardingDocumentMeta = Pick<
  OnboardingDocument,
  | 'id'
  | 'title'
  | 'slug'
  | 'type'
  | 'category'
  | 'flowType'
  | 'tier'
  | 'stepNumber'
  | 'unlockGroup'
  | 'displayOrder'
  | 'sortOrder'
  | 'folder'
  | 'isRequired'
  | 'isActive'
  | 'pdfUrl'
  | 'createdAt'
  | 'updatedAt'
>

export type StepProgress = {
  document: OnboardingDocumentMeta
  completion: OnboardingCompletion | null
  isComplete: boolean
  isLocked: boolean
  isAvailable: boolean
}

export type OnboardingProgressSnapshot = {
  steps: StepProgress[]
  completedCount: number
  totalRbtSteps: number
  tierACompleted: number
  tierATotal: number
  tierBCompleted: number
  tierBTotal: number
  tierAComplete: boolean
  tierBComplete: boolean
  fullyActivated: boolean
  profile: Pick<
    RBTProfile,
    | 'tierACompletedAt'
    | 'tierBCompletedAt'
    | 'fullyActivatedAt'
    | 'backgroundCheckClearedAt'
    | 'supervisionCountersignedAt'
    | 'supervisionContractStatus'
    | 'artemisTrainingCompleted'
  >
}

function isDocComplete(
  doc: Pick<OnboardingDocument, 'flowType' | 'slug'>,
  completion: Pick<OnboardingCompletion, 'status'> | undefined | null,
  profile: Pick<RBTProfile, 'artemisTrainingCompleted' | 'backgroundCheckClearedAt' | 'supervisionCountersignedAt'>
): boolean {
  if (doc.flowType === 'ADMIN_ONLY') {
    if (doc.slug === 'background-check-cleared') return !!profile.backgroundCheckClearedAt
    if (doc.slug === 'supervision-countersigned') return !!profile.supervisionCountersignedAt
    return false
  }
  if (doc.flowType === 'BOOKING' && doc.slug === 'artemis-training') {
    return profile.artemisTrainingCompleted === true || completion?.status === 'COMPLETED'
  }
  return completion?.status === 'COMPLETED'
}

export function completedStepNumbers(
  documents: Array<Pick<OnboardingDocument, 'id' | 'stepNumber' | 'flowType' | 'slug'>>,
  completions: Array<Pick<OnboardingCompletion, 'documentId' | 'status'>>,
  profile: Pick<RBTProfile, 'artemisTrainingCompleted' | 'backgroundCheckClearedAt' | 'supervisionCountersignedAt'>
): Set<number> {
  const byDoc = new Map(completions.map((c) => [c.documentId, c]))
  const done = new Set<number>()
  for (const doc of documents) {
    if (doc.stepNumber == null) continue
    if (isDocComplete(doc, byDoc.get(doc.id), profile)) done.add(doc.stepNumber)
  }
  return done
}

export function canUnlockStep(
  stepNumber: number,
  done: Set<number>,
  catalog = ONBOARDING_CATALOG
): boolean {
  const entry = catalog.find((e) => e.stepNumber === stepNumber)
  if (!entry || entry.flowType === 'ADMIN_ONLY') return false

  if (stepNumber === 1) return true
  if (!done.has(1)) return false

  if (stepNumber >= 2 && stepNumber <= 13) {
    for (let n = 2; n < stepNumber; n++) {
      if (!done.has(n)) return false
    }
    return true
  }

  if (stepNumber >= 14 && stepNumber <= 19) {
    if (!done.has(13)) return false
    return true
  }

  if (stepNumber >= 20 && stepNumber <= 25) {
    if (!done.has(13)) return false
    for (let n = 14; n <= 19; n++) {
      if (!done.has(n)) return false
    }
    return true
  }

  if (stepNumber >= TIER_B_FIRST_STEP && stepNumber <= TIER_B_LAST_STEP) {
    for (let n = 1; n <= TIER_A_LAST_STEP; n++) {
      if (!done.has(n)) return false
    }
    return true
  }

  return false
}

export function isTierAComplete(done: Set<number>): boolean {
  for (let n = 1; n <= TIER_A_LAST_STEP; n++) {
    if (!done.has(n)) return false
  }
  return true
}

export function isTierBComplete(done: Set<number>): boolean {
  for (let n = TIER_B_FIRST_STEP; n <= TIER_B_LAST_STEP; n++) {
    if (!done.has(n)) return false
  }
  return true
}

export function isFullyActivated(
  done: Set<number>,
  profile: Pick<RBTProfile, 'backgroundCheckClearedAt' | 'supervisionCountersignedAt' | 'fullyActivatedAt'>
): boolean {
  if (profile.fullyActivatedAt) return true
  return (
    isTierAComplete(done) &&
    isTierBComplete(done) &&
    !!profile.backgroundCheckClearedAt &&
    !!profile.supervisionCountersignedAt
  )
}

export async function getOnboardingProgress(rbtProfileId: string): Promise<OnboardingProgressSnapshot> {
  const [documents, completions, profile] = await Promise.all([
    prisma.onboardingDocument.findMany({
      where: { isActive: true, stepNumber: { not: null } },
      orderBy: { stepNumber: 'asc' },
      select: {
        id: true,
        title: true,
        slug: true,
        type: true,
        category: true,
        flowType: true,
        tier: true,
        stepNumber: true,
        unlockGroup: true,
        displayOrder: true,
        sortOrder: true,
        folder: true,
        isRequired: true,
        isActive: true,
        pdfUrl: true,
        createdAt: true,
        updatedAt: true,
      },
    }),
    prisma.onboardingCompletion.findMany({ where: { rbtProfileId } }),
    prisma.rBTProfile.findUniqueOrThrow({
      where: { id: rbtProfileId },
      select: {
        tierACompletedAt: true,
        tierBCompletedAt: true,
        fullyActivatedAt: true,
        backgroundCheckClearedAt: true,
        supervisionCountersignedAt: true,
        supervisionContractStatus: true,
        artemisTrainingCompleted: true,
      },
    }),
  ])

  const done = completedStepNumbers(documents, completions, profile)
  const rbtDocs = documents.filter((d) => d.flowType !== 'ADMIN_ONLY' && d.stepNumber != null)

  const steps: StepProgress[] = rbtDocs.map((document) => {
    const completion = completions.find((c) => c.documentId === document.id) ?? null
    const isComplete = isDocComplete(document, completion, profile)
    const stepNum = document.stepNumber!
    const isLocked = !canUnlockStep(stepNum, done)
    return {
      document,
      completion,
      isComplete,
      isLocked,
      isAvailable: !isLocked && !isComplete,
    }
  })

  const tierADocs = rbtDocs.filter((d) => d.tier === 'TIER_A')
  const tierBDocs = rbtDocs.filter((d) => d.tier === 'TIER_B')

  return {
    steps,
    completedCount: steps.filter((s) => s.isComplete).length,
    totalRbtSteps: RBT_VISIBLE_STEPS,
    tierACompleted: tierADocs.filter((d) => done.has(d.stepNumber!)).length,
    tierATotal: tierADocs.length,
    tierBCompleted: tierBDocs.filter((d) => done.has(d.stepNumber!)).length,
    tierBTotal: tierBDocs.length,
    tierAComplete: isTierAComplete(done),
    tierBComplete: isTierBComplete(done),
    fullyActivated: isFullyActivated(done, profile),
    profile,
  }
}

export async function ensureOnboardingCompletionsForRbt(rbtProfileId: string): Promise<void> {
  const docs = await prisma.onboardingDocument.findMany({
    where: { isActive: true, stepNumber: { lte: TOTAL_ONBOARDING_STEPS } },
    select: { id: true },
  })
  for (const doc of docs) {
    await prisma.onboardingCompletion.upsert({
      where: { rbtProfileId_documentId: { rbtProfileId, documentId: doc.id } },
      create: { rbtProfileId, documentId: doc.id, status: 'NOT_STARTED' },
      update: {},
    })
  }
}

export async function syncTierMilestones(rbtProfileId: string): Promise<void> {
  const progress = await getOnboardingProgress(rbtProfileId)
  const now = new Date()
  const updates: {
    tierACompletedAt?: Date
    tierBCompletedAt?: Date
    fullyActivatedAt?: Date
  } = {}

  if (progress.tierAComplete && !progress.profile.tierACompletedAt) {
    updates.tierACompletedAt = now
  }
  if (progress.tierBComplete && !progress.profile.tierBCompletedAt) {
    updates.tierBCompletedAt = now
  }
  if (progress.fullyActivated && !progress.profile.fullyActivatedAt) {
    updates.fullyActivatedAt = now
  }

  if (Object.keys(updates).length > 0) {
    await prisma.rBTProfile.update({ where: { id: rbtProfileId }, data: updates })
  }
}

export function isSocialSecurityUploadComplete(progress: OnboardingProgressSnapshot): boolean {
  const step = progress.steps.find((s) => s.document.slug === 'upload-social-security-card')
  return step?.isComplete ?? false
}

export function incompleteRbtOnboardingSteps(progress: OnboardingProgressSnapshot): Array<{
  title: string
  description: string | null
  taskType: string
}> {
  return progress.steps
    .filter((s) => !s.isComplete && s.document.flowType !== 'ADMIN_ONLY')
    .map((s) => ({
      title: s.document.title,
      description: null,
      taskType: s.document.type,
    }))
}

export function firstIncompleteStep(progress: OnboardingProgressSnapshot): number | null {
  const visible = getRbtVisibleCatalog()
  const done = new Set(
    progress.steps.filter((s) => s.isComplete).map((s) => s.document.stepNumber!)
  )
  for (const entry of visible) {
    if (!done.has(entry.stepNumber) && canUnlockStep(entry.stepNumber, done)) {
      return entry.stepNumber
    }
  }
  for (const entry of visible) {
    if (!done.has(entry.stepNumber)) return entry.stepNumber
  }
  return null
}
