import { NextRequest, NextResponse } from 'next/server'
import { requireBillingManagerSession } from '@/lib/auth'
import {
  loadEntryHoursConfirmation,
  sendEntryHoursConfirmation,
} from '@/lib/billing/entryHoursConfirmation'

export async function GET(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  const auth = await requireBillingManagerSession()
  if (auth.response) return auth.response

  const data = await loadEntryHoursConfirmation(params.id)
  if (!data) {
    return NextResponse.json({ error: 'Entry not found or not eligible' }, { status: 404 })
  }

  return NextResponse.json({
    entryId: data.entryId,
    name: data.name,
    email: data.email,
    canEmail: data.canEmail,
    subject: data.subject,
    previewHtml: data.previewHtml,
    totalHours: data.totalHours,
    incompleteHours: data.confirmation.incompleteHours,
  })
}

export async function POST(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  const auth = await requireBillingManagerSession()
  if (auth.response) return auth.response

  const result = await sendEntryHoursConfirmation(params.id)
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 400 })
  }

  return NextResponse.json({
    sent: result.sent,
    email: result.email,
    name: result.name,
  })
}
