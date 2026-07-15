import type { SessionUser } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { Prisma } from '@prisma/client'
import { parseYtdSnapshot, type ParsedSnapshot } from './ytd-snapshot-parser'
import {
  countEmployeesWithPay,
  deriveRunsFromSnapshots,
  type DerivedRun,
} from './ytd-snapshot-diff'
import { hasPayActivity, mapTaxScalars } from './ytd-line-helpers'
import { matchPayrollNameForYtd } from './matchYtd'
import type { PayrollMatchCandidate } from './types'
import type { YtdParsePreview } from './ytd-preview-types'

export type { YtdParsePreview } from './ytd-preview-types'

export type YtdNameMapping = {
  payrollName: string
  /** Set to a profile id when matched; null when importing unmatched / contractor */
  rbtProfileId: string | null
  /** true = import as contractor / non-employee (leave unmatched) */
  importUnmatched: boolean
}

function toJson(value: unknown): Prisma.InputJsonValue {
  return value as Prisma.InputJsonValue
}

export async function parseYtdBatchPreview(files: { name: string; buffer: Buffer }[]): Promise<{
  preview: YtdParsePreview
  snaps: ParsedSnapshot[]
  derived: DerivedRun[]
}> {
  const snapResults: YtdParsePreview['snapshots'] = []
  const snaps: ParsedSnapshot[] = []
  let blockingError: string | null = null

  for (const f of files) {
    try {
      const parsed = parseYtdSnapshot(f.buffer, f.name)
      snaps.push(parsed)
      snapResults.push({
        fileName: f.name,
        periodStart: parsed.periodStart.toISOString(),
        periodEnd: parsed.periodEnd.toISOString(),
        employeeCount: parsed.employees.length,
        ytdGross: parsed.grandTotal.totalGross,
        ok: true,
        warnings: parsed.warnings,
      })
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Parse failed'
      snapResults.push({
        fileName: f.name,
        periodStart: '',
        periodEnd: '',
        employeeCount: 0,
        ytdGross: 0,
        ok: false,
        error: msg,
        warnings: [],
      })
      blockingError = blockingError ?? msg
    }
  }

  snapResults.sort((a, b) => a.periodEnd.localeCompare(b.periodEnd))

  let derived: DerivedRun[] = []
  if (!blockingError && snaps.length > 0) {
    try {
      derived = deriveRunsFromSnapshots(snaps)
    } catch (e) {
      blockingError = e instanceof Error ? e.message : 'Diff failed'
    }
  }

  const payDates = derived.map((r) => r.payDate)
  const existing =
    payDates.length === 0
      ? []
      : await prisma.payrollRun.findMany({
          where: {
            OR: [
              { payDate: { in: payDates } },
              ...derived.map((r) => ({
                AND: [
                  { periodStart: { lte: r.periodEnd } },
                  { periodEnd: { gte: r.periodStart } },
                ],
              })),
            ],
          },
          select: {
            id: true,
            label: true,
            payDate: true,
            periodStart: true,
            periodEnd: true,
            sourceFormat: true,
          },
        })

  const overlaps: string[] = []
  for (const ex of existing) {
    overlaps.push(
      `${ex.label} (${ex.sourceFormat}, pay ${ex.payDate.toISOString().slice(0, 10)}) overlaps a derived period`
    )
  }

  const candidates = await prisma.rBTProfile.findMany({
    where: { status: { in: ['HIRED', 'ONBOARDING_COMPLETED'] } },
    select: { id: true, firstName: true, lastName: true, payrollName: true },
    orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }],
  })

  const matchCandidates: PayrollMatchCandidate[] = candidates
  const names = new Set<string>()
  for (const s of snaps) {
    for (const e of s.employees) names.add(e.rawName.trim())
  }

  const nameMatches = [...names].sort().map((payrollName) => {
    const m = matchPayrollNameForYtd(payrollName, matchCandidates)
    const suggested = m.suggestedRbtProfileId
      ? candidates.find((c) => c.id === m.suggestedRbtProfileId)
      : m.rbtProfileId
        ? candidates.find((c) => c.id === m.rbtProfileId)
        : null
    return {
      payrollName,
      matchStatus: m.matchStatus,
      matchConfidence: m.matchConfidence,
      rbtProfileId: m.rbtProfileId,
      suggestedRbtProfileId: m.suggestedRbtProfileId,
      suggestedName: suggested ? `${suggested.firstName} ${suggested.lastName}`.trim() : null,
    }
  })

  const preview: YtdParsePreview = {
    snapshots: snapResults,
    runs: derived.map((r) => ({
      label: r.label,
      payDate: r.payDate.toISOString(),
      periodStart: r.periodStart.toISOString(),
      periodEnd: r.periodEnd.toISOString(),
      sourceSnapshot: r.sourceSnapshot,
      employeeCount: countEmployeesWithPay(r.entries),
      hours: r.grandTotalDelta.totalHours,
      values: r.grandTotalDelta.reportedTotalValues,
      gross: r.grandTotalDelta.totalGross,
      net: r.grandTotalDelta.netPay,
      employerTax: r.grandTotalDelta.totalEmployerTax,
      checksumOk: r.checksumOk,
      warnings: r.warnings,
      entries: r.entries
        .filter((e) => hasPayActivity(e))
        .map((e) => ({
          rawName: e.rawName,
          totalHours: e.totalHours,
          totalGross: e.totalGross,
          netPay: e.netPay,
          isContractor: e.isContractor,
          totalEmployeeTax: e.totalEmployeeTax,
          totalEmployerTax: e.totalEmployerTax,
        })),
    })),
    nameMatches,
    candidates: candidates.map((c) => ({
      id: c.id,
      name: `${c.firstName} ${c.lastName}`.trim(),
    })),
    overlaps,
    blockingError,
  }

  return { preview, snaps, derived }
}

export async function createPayrollRunsFromYtdImport(
  files: { name: string; buffer: Buffer }[],
  mappings: YtdNameMapping[],
  user: SessionUser
) {
  const { preview, snaps, derived } = await parseYtdBatchPreview(files)
  if (preview.blockingError) {
    throw new Error(preview.blockingError)
  }
  if (derived.length === 0) {
    throw new Error('No derived periods to import')
  }
  if (preview.runs.some((r) => !r.checksumOk)) {
    throw new Error('One or more periods failed checksum — refuse to import')
  }

  const mapByName = new Map(mappings.map((m) => [m.payrollName.trim(), m]))
  for (const nm of preview.nameMatches) {
    if (!mapByName.has(nm.payrollName)) {
      throw new Error(`Missing mapping for ${nm.payrollName}`)
    }
  }

  const ytdByFile = new Map(snaps.map((s) => [s.fileName, s]))

  const runIds = await prisma.$transaction(async (tx) => {
    const ids: string[] = []

    for (const run of derived) {
      const activeEntries = run.entries.filter((e) => hasPayActivity(e))
      const snap = ytdByFile.get(run.sourceSnapshot)
      const totalNetPay = activeEntries.reduce((s, e) => s + e.netPay, 0)
      const totalGrossPay = activeEntries.reduce((s, e) => s + e.totalGross, 0)

      const existing = await tx.payrollRun.findUnique({
        where: {
          payDate_sourceFormat: {
            payDate: run.payDate,
            sourceFormat: 'YTD_SNAPSHOT',
          },
        },
      })

      if (existing) {
        await tx.payrollRunEntry.deleteMany({ where: { payrollRunId: existing.id } })
        await tx.payrollRun.update({
          where: { id: existing.id },
          data: {
            label: run.label,
            periodStart: run.periodStart,
            periodEnd: run.periodEnd,
            sourceFileName: run.sourceSnapshot,
            snapshotFileName: run.sourceSnapshot,
            snapshotReportedAt: snap?.reportCreatedAt ?? null,
            uploadedById: user.id,
            employeeCount: activeEntries.length,
            totalNetPay,
            totalGrossPay,
            totalEmployeeTax: run.grandTotalDelta.totalEmployeeTax,
            totalEmployeeDeductions: run.grandTotalDelta.totalEmployeeDeductions,
            totalEmployerTax: run.grandTotalDelta.totalEmployerTax,
            status: 'DRAFT',
            sourceFormat: 'YTD_SNAPSHOT',
            isDerived: true,
            checksumOk: run.checksumOk,
            importWarnings: toJson(run.warnings),
          },
        })
        ids.push(existing.id)
      } else {
        const created = await tx.payrollRun.create({
          data: {
            label: run.label,
            payDate: run.payDate,
            periodStart: run.periodStart,
            periodEnd: run.periodEnd,
            sourceFileName: run.sourceSnapshot,
            snapshotFileName: run.sourceSnapshot,
            snapshotReportedAt: snap?.reportCreatedAt ?? null,
            uploadedById: user.id,
            employeeCount: activeEntries.length,
            totalNetPay,
            totalGrossPay,
            totalEmployeeTax: run.grandTotalDelta.totalEmployeeTax,
            totalEmployeeDeductions: run.grandTotalDelta.totalEmployeeDeductions,
            totalEmployerTax: run.grandTotalDelta.totalEmployerTax,
            status: 'DRAFT',
            sourceFormat: 'YTD_SNAPSHOT',
            isDerived: true,
            checksumOk: run.checksumOk,
            importWarnings: toJson(run.warnings),
          },
        })
        ids.push(created.id)
      }

      const runId = ids[ids.length - 1]!
      const usedProfiles = new Set<string>()

      for (const emp of activeEntries) {
        const mapping = mapByName.get(emp.rawName.trim())
        if (!mapping) throw new Error(`Missing mapping for ${emp.rawName}`)

        let rbtProfileId: string | null = null
        let matchStatus: 'MATCHED' | 'NEEDS_REVIEW' | 'UNMATCHED' = 'UNMATCHED'
        let matchConfidence = 0

        if (mapping.importUnmatched || !mapping.rbtProfileId) {
          rbtProfileId = null
          matchStatus = 'UNMATCHED'
          matchConfidence = 0
        } else {
          if (usedProfiles.has(mapping.rbtProfileId)) {
            matchStatus = 'NEEDS_REVIEW'
            rbtProfileId = null
            matchConfidence = 0.5
          } else {
            rbtProfileId = mapping.rbtProfileId
            matchStatus = 'MATCHED'
            matchConfidence = 1
            usedProfiles.add(mapping.rbtProfileId)
          }
        }

        const taxes = mapTaxScalars(emp)
        const ytdEmp = snap?.employees.find((e) => e.rawName.trim() === emp.rawName.trim())
        const employerDeductionTotal = emp.totalEmployerDeductions
        const totalPayrollCost = roundMoney(
          emp.totalGross + emp.totalEmployerTax + employerDeductionTotal
        )

        await tx.payrollRunEntry.create({
          data: {
            payrollRunId: runId,
            rbtProfileId,
            payrollName: emp.rawName,
            matchStatus,
            matchConfidence,
            totalHours: emp.totalHours,
            grossPay: emp.totalGross,
            adjustedGross: null,
            empTaxTotal: emp.totalEmployeeTax,
            empTaxFIT: taxes.empTaxFIT,
            empTaxSS: taxes.empTaxSS,
            empTaxMed: taxes.empTaxMed,
            empTaxNYIT: taxes.empTaxNYIT,
            empTaxLocal: taxes.empTaxLocal,
            empTaxStateOther: taxes.empTaxStateOther,
            empDeductionTotal: emp.totalEmployeeDeductions,
            netPay: emp.netPay,
            employerTaxTotal: emp.totalEmployerTax,
            totalPayrollCost,
            isContractor: emp.isContractor,
            earningsLines: toJson(emp.earnings),
            empTaxLines: toJson(emp.employeeTaxes),
            empDeductionLines: toJson(emp.employeeDeductions),
            employerTaxLines: toJson(emp.employerTaxes),
            employerDeductionLines: toJson(emp.employerDeductions),
            reportedTotalValues: emp.reportedTotalValues,
            ytdGross: ytdEmp?.totalGross ?? null,
            ytdNetPay: ytdEmp?.netPay ?? null,
            payrollEmployeeId: emp.payrollEmployeeId,
          },
        })

        if (rbtProfileId && matchStatus === 'MATCHED') {
          await tx.rBTProfile.update({
            where: { id: rbtProfileId },
            data: { payrollName: emp.rawName },
          })
        }
      }
    }

    return ids
  })

  return { runIds, periodCount: derived.length }
}

function roundMoney(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100
}
