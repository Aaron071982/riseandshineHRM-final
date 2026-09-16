import { prisma } from '@/lib/prisma'
import { supabaseAdmin, STORAGE_BUCKET } from '@/lib/supabase'
import { loadCatalogPdfBytes } from '@/lib/onboarding/hr-tasks'
import {
  LS54_SLUG,
  formatOvertimeRate,
  parseHourlyRate,
  parseLs54FormMeta,
  type Ls54FillInput,
} from '@/lib/onboarding/ls54'
import { fillLs54Pdf } from '@/lib/onboarding/ls54-pdf'

export type GenerateLs54HrPdfResult =
  | { ok: true; buffer: Buffer; storagePath: string; formMeta: object }
  | { ok: false; error: string; details?: string }

export async function generateLs54HrPdfForRbt(
  rbtProfileId: string,
  input: Ls54FillInput
): Promise<GenerateLs54HrPdfResult> {
  const hourly = parseHourlyRate(input.employeeRateOfPay)
  if (!hourly) {
    return { ok: false, error: 'Enter a valid hourly rate of pay' }
  }

  const pdfBytes = await loadCatalogPdfBytes(LS54_SLUG)
  if (!pdfBytes) {
    return {
      ok: false,
      error: 'LS-54 PDF template not found on the server',
      details: 'Ensure onboarding-documents/LS54.pdf is deployed.',
    }
  }

  const employeeName = input.employeeName.trim()
  if (!employeeName) {
    return { ok: false, error: 'Employee name is required for LS-54' }
  }

  const overtimeParsed = parseHourlyRate(input.overtimeRate)
  const overtimeRate = (overtimeParsed ?? hourly * 1.5).toFixed(2)
  const rateOfPay = hourly.toFixed(2)

  let filledBuffer: Buffer
  try {
    filledBuffer = await fillLs54Pdf(pdfBytes, {
      employeeName,
      employeeRateOfPay: rateOfPay,
      overtimeRate,
    })
  } catch (fillErr) {
    console.error('[ls54-hr-send] fill PDF', fillErr)
    return {
      ok: false,
      error: 'Failed to fill LS-54 form',
      details: fillErr instanceof Error ? fillErr.message : String(fillErr),
    }
  }

  if (!supabaseAdmin) {
    return { ok: false, error: 'Storage not configured' }
  }

  const storagePath = `hr-documents/${rbtProfileId}/${LS54_SLUG}-hr-${Date.now()}.pdf`
  const { error: uploadError } = await supabaseAdmin.storage
    .from(STORAGE_BUCKET)
    .upload(storagePath, filledBuffer, {
      contentType: 'application/pdf',
      upsert: true,
    })

  if (uploadError) {
    console.error('[ls54-hr-send] upload', uploadError)
    return { ok: false, error: 'Failed to store PDF', details: uploadError.message }
  }

  return {
    ok: true,
    buffer: filledBuffer,
    storagePath,
    formMeta: {
      employeeRateOfPay: rateOfPay,
      overtimeRate,
      employeeName,
    },
  }
}

/** Rebuild LS-54 from task notes + profile (for already-sent tasks with blank PDFs). */
export async function regenerateLs54HrPdfFromTask(
  taskId: string,
  rbtProfileId: string
): Promise<GenerateLs54HrPdfResult> {
  const [task, profile] = await Promise.all([
    prisma.hRDocumentTask.findFirst({
      where: { id: taskId, rbtProfileId, documentType: LS54_SLUG },
      select: { id: true, notes: true, status: true },
    }),
    prisma.rBTProfile.findUnique({
      where: { id: rbtProfileId },
      select: { firstName: true, lastName: true, hourlyPayRate: true },
    }),
  ])
  if (!task) return { ok: false, error: 'Task not found' }
  if (!profile) return { ok: false, error: 'RBT profile not found' }

  const meta = parseLs54FormMeta(task.notes)
  const employeeName =
    meta?.employeeName ||
    `${profile.firstName} ${profile.lastName}`.trim()
  const employeeRateOfPay =
    meta?.employeeRateOfPay ||
    (profile.hourlyPayRate != null && profile.hourlyPayRate > 0
      ? String(profile.hourlyPayRate)
      : '')
  const overtimeRate =
    meta?.overtimeRate ||
    (parseHourlyRate(employeeRateOfPay)
      ? formatOvertimeRate(parseHourlyRate(employeeRateOfPay)!)
      : '')

  if (!employeeRateOfPay) {
    return {
      ok: false,
      error:
        'No pay rate saved for this task and no hourly rate on the RBT profile — enter a rate and send again, or set hourly pay on the profile.',
    }
  }

  return generateLs54HrPdfForRbt(rbtProfileId, {
    employeeName,
    employeeRateOfPay,
    overtimeRate,
  })
}
