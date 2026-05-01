import { NextRequest, NextResponse } from 'next/server'
import { requireClientManagerSession } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { isCrmClientStatus } from '@/lib/crm-client/constants'
import { RBTStatus } from '@prisma/client'
import { geocodeAddress } from '@/lib/mapbox-geocode'

export const dynamic = 'force-dynamic'

function parseCsvRows(csv: string): string[][] {
  return csv
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) =>
      line.split(',').map((cell) => cell.trim().replace(/^"|"$/g, ''))
    )
}

function splitName(full: string): { first: string; last: string } {
  const p = full.trim().split(/\s+/)
  if (p.length === 1) return { first: p[0] ?? '', last: '' }
  const last = p[p.length - 1] ?? ''
  const first = p.slice(0, -1).join(' ')
  return { first, last }
}

async function resolveRbt(name: string): Promise<string | null> {
  const { first, last } = splitName(name)
  if (!first) return null
  const rbt = await prisma.rBTProfile.findFirst({
    where: {
      status: RBTStatus.HIRED,
      firstName: { equals: first, mode: 'insensitive' },
      lastName: { equals: last, mode: 'insensitive' },
    },
    select: { id: true },
  })
  return rbt?.id ?? null
}

async function resolveBcba(fullName: string): Promise<string | null> {
  if (!fullName.trim()) return null
  const bcba = await prisma.bCBAProfile.findFirst({
    where: { fullName: { equals: fullName.trim(), mode: 'insensitive' } },
    select: { id: true },
  })
  return bcba?.id ?? null
}

export async function POST(request: NextRequest) {
  const auth = await requireClientManagerSession()
  if (auth.response) return auth.response

  try {
    const body = await request.json().catch(() => ({}))
    const csv = typeof body.csv === 'string' ? body.csv : ''
    const mode = body.mode === 'commit' ? 'commit' : 'preview'

    if (!csv.trim()) {
      return NextResponse.json({ error: 'csv is required' }, { status: 400 })
    }

    const rows = parseCsvRows(csv)
    if (rows.length < 2) {
      return NextResponse.json({ error: 'Need header + at least one row' }, { status: 400 })
    }

    const header = rows[0].map((h) => h.toLowerCase())
    const idx = (name: string) => header.indexOf(name)

    const previewRows: Record<string, unknown>[] = []
    let created = 0

    for (let i = 1; i < rows.length; i++) {
      const cells = rows[i]
      const row: Record<string, string> = {}
      header.forEach((h, j) => {
        row[h] = cells[j] ?? ''
      })

      const firstName = row['first name'] || row['firstname'] || cells[0] || ''
      const lastName = row['last name'] || row['lastname'] || cells[1] || ''
      const statusRaw = row['status'] || 'NEW_INTAKE'
      const city = row['city'] || ''
      const state = row['state'] || ''
      const zip = row['zip'] || row['zipcode'] || ''
      const insuranceProvider = row['insurance provider'] || row['insuranceprovider'] || ''
      const authEnd = row['auth end date'] || row['authenddate'] || ''
      const rbtName = row['assigned rbt name'] || row['assignedrbtname'] || ''
      const bcbaName = row['assigned bcba name'] || row['assignedbcbaname'] || ''

      const issues: string[] = []
      const status = isCrmClientStatus(statusRaw) ? statusRaw : 'NEW_INTAKE'
      if (!isCrmClientStatus(statusRaw)) issues.push(`Invalid status "${statusRaw}", using NEW_INTAKE`)

      let rbtId: string | null = null
      let bcbaId: string | null = null
      if (rbtName.trim()) {
        rbtId = await resolveRbt(rbtName)
        if (!rbtId) issues.push(`RBT not found: ${rbtName}`)
      }
      if (bcbaName.trim()) {
        bcbaId = await resolveBcba(bcbaName)
        if (!bcbaId) issues.push(`BCBA not found: ${bcbaName}`)
      }

      previewRows.push({
        line: i + 1,
        firstName,
        lastName,
        status,
        city,
        state,
        zip,
        insuranceProvider,
        authEndDate: authEnd || null,
        rbtId,
        bcbaId,
        issues,
      })

      if (mode === 'commit' && firstName && lastName) {
        const client = await prisma.crmClient.create({
          data: {
            firstName,
            lastName,
            status,
            city: city || null,
            state: state || null,
            zipCode: zip || null,
            insuranceProvider: insuranceProvider || null,
            authorizationEndDate: authEnd ? new Date(authEnd) : null,
            createdByUserId: auth.user.id,
          },
        })
        const coords = await geocodeAddress(null, city || null, state || null, zip || null)
        if (coords) {
          await prisma.crmClient.update({
            where: { id: client.id },
            data: { latitude: coords.lat, longitude: coords.lng },
          })
        }
        if (rbtId) {
          await prisma.clientRbtAssignment.create({
            data: {
              clientId: client.id,
              rbtProfileId: rbtId,
              assignedByUserId: auth.user.id,
              isPrimary: true,
              status: 'ACTIVE',
              daysOfWeek: [],
            },
          })
        }
        if (bcbaId) {
          await prisma.clientBcbaAssignment.create({
            data: {
              clientId: client.id,
              bcbaProfileId: bcbaId,
              assignedByUserId: auth.user.id,
              isPrimary: true,
              status: 'ACTIVE',
            },
          })
        }
        await prisma.clientStatusHistory.create({
          data: {
            clientId: client.id,
            fromStatus: null,
            toStatus: status,
            changedByUserId: auth.user.id,
            reason: 'CSV import',
          },
        })
        created++
      }
    }

    if (mode === 'preview') {
      return NextResponse.json({ preview: previewRows, rowCount: previewRows.length })
    }

    await prisma.activityLog.create({
      data: {
        userId: auth.user.id,
        activityType: 'FORM_SUBMISSION',
        action: 'CRM_CLIENT_CSV_IMPORT',
        resourceType: 'CrmClient',
        resourceId: 'bulk',
        metadata: { created, rows: previewRows.length },
      },
    }).catch(() => {})

    return NextResponse.json({ success: true, created, rows: previewRows.length })
  } catch (e) {
    console.error('[import clients]', e)
    return NextResponse.json({ error: 'Import failed', details: String(e) }, { status: 500 })
  }
}
