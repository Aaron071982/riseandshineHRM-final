import 'server-only'

import { supabaseAdmin } from '@/lib/supabase'
import { CASE_COORDINATION_FILES_BUCKET } from '@/lib/crm/caseCoordination/storagePaths'

export async function downloadCaseCoordinationPdf(
  storagePath: string
): Promise<{ bytes: Buffer; contentType: string }> {
  if (!supabaseAdmin) {
    throw new Error('Storage not configured')
  }
  const { data, error } = await supabaseAdmin.storage
    .from(CASE_COORDINATION_FILES_BUCKET)
    .download(storagePath.trim())
  if (error || !data) {
    console.error('[case-coordination] download failed', error)
    throw new Error('Download failed')
  }
  const bytes = Buffer.from(await data.arrayBuffer())
  return { bytes, contentType: data.type || 'application/pdf' }
}

export async function uploadCaseCoordinationPdf(input: {
  storagePath: string
  bytes: Buffer
}): Promise<void> {
  if (!supabaseAdmin) {
    throw new Error('Storage not configured')
  }
  const { error } = await supabaseAdmin.storage
    .from(CASE_COORDINATION_FILES_BUCKET)
    .upload(input.storagePath, input.bytes, {
      contentType: 'application/pdf',
      upsert: true,
    })
  if (error) {
    console.error('[case-coordination] upload failed', error)
    throw new Error('Upload failed')
  }
}
