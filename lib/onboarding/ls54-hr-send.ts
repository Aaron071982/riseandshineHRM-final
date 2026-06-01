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

  const overtimeRate = input.overtimeRate || formatOvertimeRate(hourly)
  let filledBuffer: Buffer
  try {
    filledBuffer = await fillLs54Pdf(pdfBytes, {
      employeeName: input.employeeName,
      employeeRateOfPay: String(hourly),
      overtimeRate,
    })
  } catch (fillErr) {
    console.error('[ls54-hr-send] fill PDF', fillErr)
    return { ok: false, error: 'Failed to fill LS-54 form' }
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
      employeeRateOfPay: String(hourly),
      overtimeRate,
      employeeName: input.employeeName,
    },
  }
}

/** Rebuild LS-54 from task notes + profile (for already-sent tasks with blank PDFs). */
export async function regenerateLs54HrPdfFromTask(
  taskId: string,
  rbtProfileId: string
): Promise<GenerateLs54HrPdfResult> {
  const task = await prisma.hRDocumentTask.findFirst({
    where: { id: taskId, rbtProfileId, documentType: LS54_SLUG },
    select: { id: true, notes: true, status: true },
  })
  if (!task) return { ok: false, error: 'Task not found' }

  const meta = parseLs54FormMeta(task.notes)
  if (!meta) {
    return { ok: false, error: 'No pay rate data saved for this task — cannot regenerate' }
  }

  return generateLs54HrPdfForRbt(rbtProfileId, {
    employeeName: meta.employeeName,
    employeeRateOfPay: meta.employeeRateOfPay,
    overtimeRate: meta.overtimeRate,
  })
}
