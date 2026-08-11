import { NextResponse } from 'next/server'
import { supabaseAdmin, STORAGE_BUCKET } from '@/lib/supabase'
import type { CompanyDocAccessRow } from '@/lib/company-documents/accessToken'

export function companyDocFileResponse(
  row: CompanyDocAccessRow,
  buf: Buffer,
  disposition: 'inline' | 'attachment'
): NextResponse {
  const contentType =
    row.companyDocument.fileType === 'png'
      ? 'image/png'
      : buf.length >= 4 && buf[0] === 0x25 && buf[1] === 0x50 && buf[2] === 0x44 && buf[3] === 0x46
        ? 'application/pdf'
        : row.companyDocument.fileType === 'pdf'
          ? 'application/pdf'
          : 'application/octet-stream'
  const ext = contentType === 'image/png' ? 'png' : contentType === 'application/pdf' ? 'pdf' : 'bin'
  const safeName = row.companyDocument.title.replace(/[^a-zA-Z0-9._-]/g, '_')
  return new NextResponse(new Uint8Array(buf), {
    status: 200,
    headers: {
      'Content-Type': contentType,
      'Content-Length': String(buf.length),
      'Content-Disposition': `${disposition}; filename="${safeName}.${ext}"`,
      'Cache-Control': 'private, no-store',
      'X-Content-Type-Options': 'nosniff',
    },
  })
}

export async function downloadCompanyDocFile(
  row: CompanyDocAccessRow
): Promise<{ buf: Buffer } | { error: string; status: number }> {
  if (!supabaseAdmin) {
    return { error: 'Storage not configured', status: 503 }
  }
  const { data, error } = await supabaseAdmin.storage
    .from(STORAGE_BUCKET)
    .download(row.companyDocument.fileUrl)
  if (error || !data) {
    return { error: 'File not found', status: 404 }
  }
  return { buf: Buffer.from(await data.arrayBuffer()) }
}
