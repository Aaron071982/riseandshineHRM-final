import { prisma } from '@/lib/prisma'
import {
  CSV_DOCUMENT_COLUMNS,
} from '@/lib/client-services/constants'
import {
  parseAddress,
  parseCsvStatus,
  parseDateLoose,
  parseNumberLoose,
  parseYesNo,
  splitBtNames,
  splitClientName,
} from '@/lib/client-services/parse'
import type { ServiceClientDocumentType } from '@prisma/client'
import { softDeleteData } from '@/lib/crm/softDelete'

export type ImportResult = {
  created: number
  updated: number
  skipped: number
  failed: { row: number; clientCode?: string; error: string }[]
}

function getField(row: Record<string, string>, ...keys: string[]): string {
  for (const key of keys) {
    if (row[key] != null && String(row[key]).trim() !== '') return String(row[key]).trim()
    // Case-insensitive / BOM-tolerant
    const found = Object.keys(row).find((k) => k.replace(/^\uFEFF/, '').trim() === key)
    if (found && row[found] != null && String(row[found]).trim() !== '') {
      return String(row[found]).trim()
    }
  }
  return ''
}

/**
 * Parse a CSV string into row objects (handles quoted fields and newlines in quotes).
 */
export function parseCsvText(text: string): Record<string, string>[] {
  const rows: string[][] = []
  let current: string[] = []
  let field = ''
  let inQuotes = false

  const pushField = () => {
    current.push(field)
    field = ''
  }
  const pushRow = () => {
    // Skip completely empty rows
    if (current.some((c) => c.trim())) rows.push(current)
    current = []
  }

  const src = text.replace(/^\uFEFF/, '')
  for (let i = 0; i < src.length; i++) {
    const ch = src[i]
    const next = src[i + 1]
    if (inQuotes) {
      if (ch === '"' && next === '"') {
        field += '"'
        i++
      } else if (ch === '"') {
        inQuotes = false
      } else {
        field += ch
      }
    } else if (ch === '"') {
      inQuotes = true
    } else if (ch === ',') {
      pushField()
    } else if (ch === '\n') {
      pushField()
      pushRow()
    } else if (ch === '\r') {
      // ignore; handle \r\n via \n
    } else {
      field += ch
    }
  }
  pushField()
  pushRow()

  if (rows.length === 0) return []
  const headers = rows[0].map((h) => h.replace(/^\uFEFF/, '').trim())
  return rows.slice(1).map((cols) => {
    const obj: Record<string, string> = {}
    headers.forEach((h, idx) => {
      obj[h] = cols[idx] ?? ''
    })
    return obj
  })
}

export async function importClientsMasterCsv(
  csvText: string,
  createdByUserId: string | null
): Promise<ImportResult> {
  const rows = parseCsvText(csvText)
  const result: ImportResult = { created: 0, updated: 0, skipped: 0, failed: [] }

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i]
    const rowNum = i + 2 // 1-indexed + header
    try {
      const clientCode = getField(row, 'Client ID')
      if (!clientCode) {
        result.skipped++
        continue
      }

      const fullName = getField(row, 'Client Name')
      const { firstName, lastName } = splitClientName(fullName)
      const status = parseCsvStatus(getField(row, 'Status'))
      const dateOfBirth = parseDateLoose(getField(row, 'DOB'))
      const address = parseAddress(
        getField(
          row,
          'Address',
          'Home Address',
          'Client Address',
          'Street Address',
          'Full Address',
          'Residential Address'
        )
      )
      const insuranceProvider = getField(row, 'Insurance') || null
      const parentName = getField(row, 'Parent Name') || null
      const parentPhone = getField(row, 'Parent Number') || null
      const parentEmail = getField(row, 'Parent Email') || null
      const bcbaName = getField(row, 'BCBA') || null
      const caseCoordinatorName = getField(row, 'Case Coordinator') || null
      const btNames = splitBtNames(getField(row, 'Assigned BTs'))
      const serviceStartDate = parseDateLoose(getField(row, 'Service Start Date'))
      const authLengthMonths = parseNumberLoose(getField(row, 'Auth Length (Months)'))
      const serviceEndDate = parseDateLoose(getField(row, 'Service End Date'))
      const authHours = parseNumberLoose(getField(row, 'Auth Hours'))
      const currentHoursPerWeek = parseNumberLoose(getField(row, 'Current Hours'))

      const existing = await prisma.serviceClient.findUnique({
        where: { clientCode },
        select: { id: true },
      })

      const data = {
        firstName,
        lastName,
        status,
        dateOfBirth,
        addressLine: address.addressLine,
        city: address.city,
        borough: address.borough,
        state: address.state,
        zip: address.zip,
        insuranceProvider,
        parentName,
        parentPhone,
        parentEmail,
        bcbaName,
        caseCoordinatorName,
        serviceStartDate,
        serviceEndDate,
        authLengthMonths: authLengthMonths != null ? Math.round(authLengthMonths) : null,
        authHours,
        currentHoursPerWeek,
      }

      let serviceClientId: string
      if (existing) {
        const existingFull = await prisma.serviceClient.findUnique({
          where: { id: existing.id },
          select: { currentOwnerDept: true },
        })
        await prisma.serviceClient.update({
          where: { id: existing.id },
          data: {
            ...data,
            ...(existingFull?.currentOwnerDept
              ? {}
              : { currentOwnerDept: 'INTAKE' }),
          },
        })
        serviceClientId = existing.id
        result.updated++

        // Replace BT assignments on re-import
        await prisma.serviceClientBtAssignment.updateMany({
          where: { serviceClientId, deletedAt: null },
          data: { ...softDeleteData(createdByUserId), status: 'ENDED' },
        })
      } else {
        const created = await prisma.serviceClient.create({
          data: {
            clientCode,
            ...data,
            stage: 'INQUIRY',
            currentOwnerDept: 'INTAKE',
            createdBy: createdByUserId,
          },
        })
        serviceClientId = created.id
        result.created++
      }

      if (btNames.length > 0) {
        await prisma.serviceClientBtAssignment.createMany({
          data: btNames.map((btName, idx) => ({
            serviceClientId,
            btName,
            isPrimary: idx === 0,
            status: 'ACTIVE' as const,
          })),
        })
      }

      // Ensure 9 document rows; update collected from CSV
      for (const col of CSV_DOCUMENT_COLUMNS) {
        const collected = parseYesNo(getField(row, col.header))
        await prisma.serviceClientDocument.upsert({
          where: {
            serviceClientId_documentType: {
              serviceClientId,
              documentType: col.type as ServiceClientDocumentType,
            },
          },
          create: {
            serviceClientId,
            documentType: col.type as ServiceClientDocumentType,
            collected,
            collectedAt: collected ? new Date() : null,
            collectedBy: collected ? createdByUserId : null,
          },
          update: {
            collected,
            collectedAt: collected ? new Date() : null,
            collectedBy: collected ? createdByUserId : null,
          },
        })
      }
    } catch (err) {
      result.failed.push({
        row: rowNum,
        clientCode: getField(row, 'Client ID') || undefined,
        error: err instanceof Error ? err.message : String(err),
      })
    }
  }

  return result
}
