/**
 * Dump raw Excel + parsed sessions for a provider.
 * Usage: npx tsx scripts/inspect-provider-rows.ts [xlsx] [providerSubstring]
 */
import { readFileSync } from 'fs'
import ExcelJS from 'exceljs'
import { parseArtemisWorkbook } from '../lib/billing/artemisParser'

const path =
  process.argv[2] ??
  '/Users/aaron/Downloads/Session reconciliation report-2026-06-30-18-31-16.xlsx'
const needle = (process.argv[3] ?? 'asiyah').toLowerCase()

async function main() {
  const buffer = readFileSync(path)
  const wb = new ExcelJS.Workbook()
  const data = Buffer.isBuffer(buffer) ? buffer : Buffer.from(buffer)
  await wb.xlsx.load(data as unknown as ExcelJS.Buffer)
  const sheet =
    wb.worksheets.find((w) => w.name.toLowerCase().includes('session reconciliation')) ??
    wb.worksheets[0]

  let headerRow = 0
  const cols: Record<string, number> = {}
  for (let r = 1; r <= 50; r++) {
    const row = sheet.getRow(r)
    const headers: Record<string, number> = {}
    row.eachCell({ includeEmpty: false }, (cell, col) => {
      const k = String(cell.text ?? cell.value)
        .toLowerCase()
        .replace(/[↑↓]/g, '')
        .trim()
      if (k) headers[k] = col
    })
    const hasProvider = Object.keys(headers).some((k) => k.includes('provider name'))
    const hasActual = Object.keys(headers).some((k) => k.includes('actual duration'))
    if (hasProvider && hasActual) {
      headerRow = r
      for (const [k, col] of Object.entries(headers)) {
        if (k.includes('provider name') && !k.includes('case')) cols.provider = col
        if (k.includes('actual duration')) cols.actual = col
        if (k === 'duration' || (k.startsWith('duration') && !k.includes('actual')))
          cols.duration = col
        if (k === 'client' || k.startsWith('client')) cols.client = col
        if (k === 'dos' || k.startsWith('dos')) cols.dos = col
        if (k === 'status' || (k.startsWith('status') && !k.includes('claim'))) cols.status = col
      }
      break
    }
  }

  console.log('File:', path)
  console.log('Header row', headerRow, cols)

  for (let r = headerRow + 1; r <= sheet.rowCount; r++) {
    const row = sheet.getRow(r)
    const provider = cols.provider
      ? String(row.getCell(cols.provider).text ?? row.getCell(cols.provider).value ?? '').trim()
      : ''
    if (!provider.toLowerCase().includes(needle)) continue
    const actualCell = cols.actual ? row.getCell(cols.actual) : null
    const durCell = cols.duration ? row.getCell(cols.duration) : null
    console.log(
      JSON.stringify({
        row: r,
        provider,
        client: cols.client ? String(row.getCell(cols.client).text ?? '') : '',
        dos: cols.dos ? row.getCell(cols.dos).value : null,
        status: cols.status
          ? String(row.getCell(cols.status).text ?? row.getCell(cols.status).value ?? '')
          : '',
        actualRaw: actualCell?.value,
        actualText: actualCell?.text,
        actualType: actualCell?.value == null ? 'null' : typeof actualCell.value,
        durationRaw: durCell?.value,
        durationText: durCell?.text,
      })
    )
  }

  const result = await parseArtemisWorkbook(buffer)
  const group = result.payrollGroups.find((g) => g.providerName.toLowerCase().includes(needle))
  if (!group) {
    console.log('\nNo provider match in parser output')
    return
  }
  console.log(`\nParser: ${group.sessions.length} sessions for ${group.providerName}`)
  for (const s of group.sessions) {
    console.log({
      dos: s.dos.toISOString().slice(0, 10),
      client: s.clientName,
      status: s.sessionStatus,
      rawStatus: s.rawStatus,
      actualMinutes: s.actualMinutes,
      hours: (s.actualMinutes / 60).toFixed(2),
      scheduledMinutes: s.scheduledMinutes,
    })
  }
}

main().catch(console.error)
