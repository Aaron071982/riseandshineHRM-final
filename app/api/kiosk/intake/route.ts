import { createHash, randomUUID } from 'crypto'
import { NextRequest, NextResponse } from 'next/server'
import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { getClientIpFromRequest } from '@/lib/client-ip'
import { requireKioskDevice } from '@/lib/kiosk/auth'
import { isIntakeComplete } from '@/lib/kiosk-intake/complete'
import { fillIntakePdf } from '@/lib/kiosk-intake/fillPdf'
import { getFormDef } from '@/lib/kiosk-intake/schema'
import { validateIntakeFormsPayload } from '@/lib/kiosk-intake/validate'

export const dynamic = 'force-dynamic'

function stripDataUrlPrefix(raw: string): string {
  const trimmed = raw.trim()
  const comma = trimmed.indexOf(',')
  if (trimmed.startsWith('data:') && comma !== -1) {
    return trimmed.slice(comma + 1)
  }
  return trimmed
}

export async function POST(request: NextRequest) {
  const auth = await requireKioskDevice(request)
  if (auth.response) return auth.response
  const { device } = auth

  let body: Record<string, unknown>
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const serviceClientId =
    typeof body.serviceClientId === 'string' ? body.serviceClientId.trim() : ''
  const signerName =
    typeof body.signerName === 'string' ? body.signerName.trim() : ''
  const signerRelationship =
    typeof body.signerRelationship === 'string'
      ? body.signerRelationship.trim()
      : ''
  const signatureHash =
    typeof body.signatureHash === 'string' ? body.signatureHash.trim() : ''
  const signaturePngBase64Raw =
    typeof body.signaturePngBase64 === 'string' ? body.signaturePngBase64 : ''
  const consentGiven = body.consentGiven === true

  if (
    !serviceClientId ||
    !signerName ||
    !signerRelationship ||
    !signatureHash ||
    !signaturePngBase64Raw ||
    !consentGiven
  ) {
    return NextResponse.json(
      {
        error:
          'serviceClientId, signerName, signerRelationship, signatureHash, signaturePngBase64, and consentGiven:true are required',
      },
      { status: 400 }
    )
  }

  const validated = validateIntakeFormsPayload(body.forms)
  if (!validated.ok) {
    return NextResponse.json({ error: validated.error }, { status: validated.status })
  }

  const client = await prisma.serviceClient.findFirst({
    where: {
      id: serviceClientId,
      isCenterClient: true,
      pipelineStatus: 'LIVE',
      deletedAt: null,
    },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      dateOfBirth: true,
    },
  })
  if (!client) {
    return NextResponse.json(
      { error: 'Client not found or not eligible for center intake' },
      { status: 404 }
    )
  }

  const signatureImageData = stripDataUrlPrefix(signaturePngBase64Raw)
  let pngBytes: Buffer
  try {
    pngBytes = Buffer.from(signatureImageData, 'base64')
    if (pngBytes.length === 0) throw new Error('empty')
  } catch {
    return NextResponse.json(
      { error: 'Invalid signaturePngBase64' },
      { status: 400 }
    )
  }

  const computedHash = createHash('sha256').update(pngBytes).digest('hex')
  if (computedHash.toLowerCase() !== signatureHash.toLowerCase()) {
    return NextResponse.json(
      { error: 'signatureHash does not match signature bytes' },
      { status: 400 }
    )
  }

  const packetId = randomUUID()
  const ip = getClientIpFromRequest(request)
  const userAgent = request.headers.get('user-agent')
  const created: { formCode: string; id: string }[] = []

  try {
    for (const [formCode, values] of Object.entries(validated.forms)) {
      const formDef = getFormDef(formCode)!
      const filledPdfData = await fillIntakePdf({
        formDef,
        client,
        signerName,
        values,
      })

      const row = await prisma.clientIntakeSubmission.create({
        data: {
          serviceClientId,
          packetId,
          formCode,
          formTitle: formDef.title,
          fieldValuesJson: values as Prisma.InputJsonValue,
          filledPdfData,
          signedByName: signerName,
          signedByRelationship: signerRelationship,
          signatureImageData,
          signatureHash: computedHash,
          signatureConsentGiven: true,
          signatureIpAddress: ip,
          signatureUserAgent: userAgent,
          kioskDeviceId: device.id,
          locationLabel: device.locationLabel,
        },
        select: { id: true, formCode: true },
      })
      created.push({ formCode: row.formCode, id: row.id })
    }
  } catch (err) {
    console.error('[kiosk/intake] submit failed', err)
    return NextResponse.json(
      { error: 'Failed to save intake packet' },
      { status: 500 }
    )
  }

  const intakeComplete = await isIntakeComplete(serviceClientId)

  return NextResponse.json(
    {
      packetId,
      forms: created,
      intakeComplete,
    },
    { status: 201 }
  )
}
