import 'server-only'

import { PAYROLL_STATEMENTS_BUCKET, PAYROLL_STATEMENTS_PREFIX } from '@/lib/constants'
import { supabaseAdmin } from '@/lib/supabase'

export function buildPayStubStoragePath(input: {
  statementId: string
  payeeType: 'BCBA' | 'RBT'
  payeeKey: string
}): string {
  const safe = input.payeeKey.replace(/[^a-zA-Z0-9_-]+/g, '_').slice(0, 64)
  return `${PAYROLL_STATEMENTS_PREFIX}/${input.payeeType.toLowerCase()}/${safe}/${input.statementId}.pdf`
}

export async function uploadPayStubPdf(input: {
  storagePath: string
  bytes: Buffer
}): Promise<void> {
  if (!supabaseAdmin) throw new Error('Storage not configured')
  const { error } = await supabaseAdmin.storage
    .from(PAYROLL_STATEMENTS_BUCKET)
    .upload(input.storagePath, input.bytes, {
      contentType: 'application/pdf',
      upsert: true,
    })
  if (error) {
    console.error('[payroll-stub] upload failed', error)
    throw new Error('Failed to store pay stub PDF')
  }
}

export async function createPayStubSignedUrl(
  storagePath: string,
  ttlSeconds = 120
): Promise<string> {
  if (!supabaseAdmin) throw new Error('Storage not configured')
  const { data, error } = await supabaseAdmin.storage
    .from(PAYROLL_STATEMENTS_BUCKET)
    .createSignedUrl(storagePath.trim(), ttlSeconds)
  if (error || !data?.signedUrl) {
    console.error('[payroll-stub] signed url failed', error)
    throw new Error('Could not create download link')
  }
  return data.signedUrl
}

export async function downloadPayStubPdf(
  storagePath: string
): Promise<Buffer> {
  if (!supabaseAdmin) throw new Error('Storage not configured')
  const { data, error } = await supabaseAdmin.storage
    .from(PAYROLL_STATEMENTS_BUCKET)
    .download(storagePath.trim())
  if (error || !data) {
    console.error('[payroll-stub] download failed', error)
    throw new Error('Pay stub file not found')
  }
  return Buffer.from(await data.arrayBuffer())
}

/** pdfUrl stores the private storage path (never a public URL). */
export function isPayStubStoragePath(value: string | null | undefined): boolean {
  if (!value) return false
  return value.startsWith(`${PAYROLL_STATEMENTS_PREFIX}/`)
}
