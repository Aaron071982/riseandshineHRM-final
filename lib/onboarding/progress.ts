import type { OnboardingCompletion, OnboardingDocument, RBTProfile } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import {
  ESIGN_CONSENT_SLUG,
  FORTY_HOUR_RBT_CERTIFICATE_SLUG,
  ONBOARDING_CATALOG,
  ORIENTATION_BOOKING_SLUG,
  RBT_VISIBLE_STEPS,
  TIER_A_LAST_STEP,
  TIER_B_FIRST_STEP,
  TIER_B_LAST_STEP,
  TOTAL_ONBOARDING_STEPS,
  getRbtVisibleCatalog,
  I9_SLUG,
  isOptionalOnboardingSlug,
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
    | 'hiredAt'
    | 'i9Section1CompletedAt'
    | 'i9Section2CompletedAt'
  >
}

/** I-9 timestamps are optional so callers that only need unlock state need not select them. */
type I9Fields = Partial<Pick<RBTProfile, 'i9Section1CompletedAt' | 'i9Section2CompletedAt'>>

export function isI9Complete(profile: I9Fields): boolean {
  return !!profile.i9Section1CompletedAt && !!profile.i9Section2CompletedAt
}

function isDocComplete(
  doc: Pick<OnboardingDocument, 'flowType' | 'slug'>,
  completion: Pick<OnboardingCompletion, 'status'> | undefined | null,
  profile: Pick<
    RBTProfile,
    | 'artemisTrainingCompleted'
    | 'backgroundCheckClearedAt'
    | 'supervisionCountersignedAt'
    | 'fortyHourCourseCompleted'
  > &
    I9Fields
): boolean {
  if (doc.slug === I9_SLUG) return isI9Complete(profile)
  if (doc.flowType === 'ADMIN_ONLY') {
    if (doc.slug === 'background-check-cleared') return !!profile.backgroundCheckClearedAt
    if (doc.slug === 'supervision-countersigned') return !!profile.supervisionCountersignedAt
    return false
  }
  if (doc.slug === FORTY_HOUR_RBT_CERTIFICATE_SLUG) {
    return profile.fortyHourCourseCompleted === true || completion?.status === 'COMPLETED'
  }
  if (doc.flowType === 'BOOKING' && doc.slug === ORIENTATION_BOOKING_SLUG) {
    return profile.artemisTrainingCompleted === true || completion?.status === 'COMPLETED'
  }
  return completion?.status === 'COMPLETED'
}

export function completedStepNumbers(
  documents: Array<Pick<OnboardingDocument, 'id' | 'stepNumber' | 'flowType' | 'slug'>>,
  completions: Array<Pick<OnboardingCompletion, 'documentId' | 'status'>>,
  profile: Pick<
    RBTProfile,
    | 'artemisTrainingCompleted'
    | 'backgroundCheckClearedAt'
    | 'supervisionCountersignedAt'
    | 'fortyHourCourseCompleted'
  > &
    I9Fields
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

  // 40-hour course is available from day one so RBTs can start it first
  // and still work through later onboarding steps in parallel.
  if (entry.slug === FORTY_HOUR_RBT_CERTIFICATE_SLUG) return true

  // Form I-9 is federally required for every employee, so it is never locked; it never gates later steps.
  if (entry.slug === I9_SLUG) return true

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
  // Optional steps (CPR, mandated reporter certificate, orientation booking) do not block activation.
  for (let n = TIER_B_FIRST_STEP; n <= TIER_B_LAST_STEP; n++) {
    const entry = ONBOARDING_CATALOG.find((e) => e.stepNumber === n)
    if (entry && isOptionalOnboardingSlug(entry.slug)) continue
    if (!done.has(n)) return false
  }
  return true
}

export function isFullyActivated(
  done: Set<number>,
  profile: Pick<RBTProfile, 'backgroundCheckClearedAt' | 'supervisionCountersignedAt' | 'fullyActivatedAt'> &
    I9Fields
): boolean {
  if (profile.fullyActivatedAt) return true
  return (
    isTierAComplete(done) &&
    isTierBComplete(done) &&
    !!profile.backgroundCheckClearedAt &&
    !!profile.supervisionCountersignedAt &&
    isI9Complete(profile)
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
        fortyHourCourseCompleted: true,
        hiredAt: true,
        i9Section1CompletedAt: true,
        i9Section2CompletedAt: true,
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
  const tierBDocs = rbtDocs.filter(
    (d) => d.tier === 'TIER_B' && !isOptionalOnboardingSlug(d.slug)
  )

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
  const fortyHour = visible.find((e) => e.slug === FORTY_HOUR_RBT_CERTIFICATE_SLUG)
  if (fortyHour && !done.has(fortyHour.stepNumber)) {
    return fortyHour.stepNumber
  }
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
