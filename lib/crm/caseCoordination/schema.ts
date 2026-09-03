import { z } from 'zod'

const optionalString = z.string().optional().nullable()

export const caseCoordinationFieldOverridesSchema = z
  .object({
    clientName: optionalString,
    serviceAddress: optionalString,
    parentGuardianName: optionalString,
    parentEmail: optionalString,
    parentContactNumber: optionalString,
    bcbaName: optionalString,
    bcbaContactNumber: optionalString,
    bcbaEmail: optionalString,
    coordinatorName: optionalString,
    coordinatorContactNumber: optionalString,
    coordinatorEmail: optionalString,
    startDate: optionalString,
  })
  .partial()

export const caseCoordinationBtRowSchema = z.object({
  id: z.string().optional(),
  rbtProfileId: z.string().optional().nullable(),
  behaviorTechnician: z.string(),
  phoneEmail: z.string().optional().nullable(),
  schedule: z.string().optional().nullable(),
  startDate: z.string().optional().nullable(),
  manual: z.boolean().optional(),
})

export const caseCoordinationOverridesSchema = z.object({
  fields: caseCoordinationFieldOverridesSchema.optional(),
  behaviorTechnicians: z.array(caseCoordinationBtRowSchema).optional(),
})

export type CaseCoordinationOverrides = z.infer<typeof caseCoordinationOverridesSchema>
export type CaseCoordinationBtRow = z.infer<typeof caseCoordinationBtRowSchema>

export function parseCaseCoordinationOverrides(
  raw: unknown
): CaseCoordinationOverrides {
  const parsed = caseCoordinationOverridesSchema.safeParse(raw ?? {})
  return parsed.success ? parsed.data : {}
}

export function mergeCaseCoordinationOverrides(
  current: CaseCoordinationOverrides | null | undefined,
  patch: CaseCoordinationOverrides
): CaseCoordinationOverrides {
  return {
    ...current,
    ...patch,
    fields: { ...current?.fields, ...patch.fields },
    behaviorTechnicians:
      patch.behaviorTechnicians ?? current?.behaviorTechnicians,
  }
}
