import { recomputeStatementTotals, round2 } from '@/lib/payroll/hoursHmm'
import { formatUsd } from '@/lib/billing/format'

export type PayStubLine = {
  workDate: Date | string
  startClock: string
  endClock: string
  hours: number
  amount: number
}

export type PayStubDeductionRow = {
  label: string
  amount: number
  employeePaid: boolean
}

export type PayStubYtd = {
  gross: number
  deductions: number
  net: number
}

export type PayStubPayload = {
  payeeType: 'BCBA' | 'RBT'
  legalName: string
  entityName: string | null
  payDate: Date | string
  periodStart: Date | string
  periodEnd: Date | string
  ratePerHour: number | null
  lineItems: PayStubLine[]
  /** Legacy single total — used when deductionRows is empty (BCBA). */
  deductions: number
  /** Itemized employee/employer rows for W-2 BT stubs. */
  deductionRows?: PayStubDeductionRow[]
  reconciled: boolean
  ytd?: PayStubYtd | null
  /** Absolute or data URL for logo embed in headless Chrome. */
  logoSrc: string
}

function asDate(d: Date | string): Date {
  return d instanceof Date ? d : new Date(d)
}

function fmtDate(d: Date | string): string {
  // Calendar dates are stored as UTC midnight — format in UTC to avoid day shift.
  const dt = asDate(d)
  const months = [
    'Jan',
    'Feb',
    'Mar',
    'Apr',
    'May',
    'Jun',
    'Jul',
    'Aug',
    'Sep',
    'Oct',
    'Nov',
    'Dec',
  ]
  return `${months[dt.getUTCMonth()]} ${dt.getUTCDate()}, ${dt.getUTCFullYear()}`
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

/**
 * Letter-sized HTML pay statement matching the BCBA stub layout
 * (logo + company header, blue PAY STATEMENT band, optional 1099 orange sub-band).
 */
export function buildPayStubHtml(payload: PayStubPayload): string {
  const isContractor = payload.payeeType === 'BCBA'
  const employeeRows = (payload.deductionRows ?? []).filter((d) => d.employeePaid)
  const deductionsFromRows = round2(
    employeeRows.reduce((sum, d) => sum + Number(d.amount), 0)
  )
  const deductions =
    employeeRows.length > 0
      ? deductionsFromRows
      : round2(payload.deductions ?? 0)

  const totals = recomputeStatementTotals(
    payload.lineItems.map((li) => ({ hours: li.hours, amount: li.amount })),
    { deductions }
  )
  // Always drive printed totals from line items (source of truth).
  const grossPay = totals.lineAmountSum
  const netPay = round2(grossPay - deductions)
  const showReconcileWarn =
    !payload.reconciled ||
    Math.abs(grossPay - totals.lineAmountSum) >= 0.005 ||
    Math.abs(netPay - round2(grossPay - deductions)) >= 0.005

  const rows = payload.lineItems
    .map((li, i) => {
      const zebra = i % 2 === 1 ? ' class="zebra"' : ''
      return `<tr${zebra}>
        <td>${escapeHtml(fmtDate(li.workDate))}</td>
        <td class="num">${escapeHtml(li.startClock)}</td>
        <td class="num">${escapeHtml(li.endClock)}</td>
        <td class="num">${li.hours.toFixed(2)}</td>
        <td class="num money">${escapeHtml(formatUsd(li.amount))}</td>
      </tr>`
    })
    .join('\n')

  const payToPrimary = escapeHtml(payload.legalName)
  const payToEntity = payload.entityName
    ? `<div class="entity">${escapeHtml(payload.entityName)}</div>`
    : ''

  const rateLabel =
    payload.ratePerHour != null ? formatUsd(payload.ratePerHour) + ' / hr' : '—'

  const subBand = isContractor
    ? `<div class="sub-band">Contractor payment — 1099 (no taxes withheld)</div>`
    : `<div class="sub-band employee">Employee earnings statement</div>`

  const footnotes = isContractor
    ? `<li>This is a 1099 contractor payment. No federal, state, or FICA taxes were withheld.</li>
       <li>Amount = hours × pay rate. Hours are computed from session start/end clocks (h.mm; <code>.30</code> = 30 minutes).</li>
       <li>Keep this statement for your records. A Form 1099-NEC will be issued if required.</li>`
    : `<li>Taxes withheld per your Form W-4 and applicable federal, New York State, and New York City rates. This is an employee earnings statement.</li>
       <li>Amount = hours × pay rate. Hours are computed from session start/end clocks (h.mm; <code>.30</code> = 30 minutes).</li>
       <li>Deduction amounts are as recorded for this pay period — they are not recalculated on this statement.</li>`

  const deductionBlock =
    !isContractor && employeeRows.length > 0
      ? employeeRows
          .map(
            (d) => `<div class="row">
        <span>${escapeHtml(d.label)}</span>
        <span>−${escapeHtml(formatUsd(d.amount))}</span>
      </div>`
          )
          .join('\n')
      : `<div class="row">
        <span>${isContractor ? 'Deductions / taxes' : 'Total deductions'}</span>
        <span>${deductions > 0 ? `−${escapeHtml(formatUsd(deductions))}` : escapeHtml(formatUsd(0))}</span>
      </div>`

  const ytdBlock =
    !isContractor && payload.ytd
      ? `<div class="ytd">
      <div class="label">Year to date</div>
      <div class="ytd-row"><span>Gross</span><span>${escapeHtml(formatUsd(payload.ytd.gross))}</span></div>
      <div class="ytd-row"><span>Deductions</span><span>−${escapeHtml(formatUsd(payload.ytd.deductions))}</span></div>
      <div class="ytd-row"><span>Net</span><span>${escapeHtml(formatUsd(payload.ytd.net))}</span></div>
    </div>`
      : ''

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8" />
<title>Pay Statement — ${payToPrimary}</title>
<style>
  @page { size: Letter; margin: 0; }
  * { box-sizing: border-box; }
  html, body {
    margin: 0;
    padding: 0;
    font-family: "Inter", "Helvetica Neue", Helvetica, Arial, sans-serif;
    color: #2A2019;
    background: #fff;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }
  .page {
    width: 8.5in;
    min-height: 11in;
    padding: 0.55in 0.6in 0.5in;
  }
  .header {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    gap: 24px;
    margin-bottom: 18px;
  }
  .logo { height: 52px; width: auto; display: block; }
  .company {
    text-align: right;
    line-height: 1.35;
  }
  .company .name {
    font-size: 15px;
    font-weight: 700;
    letter-spacing: 0.01em;
  }
  .company .tag {
    font-size: 11px;
    font-style: italic;
    color: #6B5E54;
    margin-top: 2px;
  }
  .company .addr {
    font-size: 11px;
    color: #6B5E54;
    margin-top: 4px;
  }
  .band {
    background: #1B4F8A;
    color: #fff;
    text-align: center;
    font-size: 15px;
    font-weight: 700;
    letter-spacing: 0.14em;
    padding: 10px 12px;
    margin-top: 4px;
  }
  .sub-band {
    background: #E7692C;
    color: #fff;
    text-align: center;
    font-size: 11px;
    font-weight: 600;
    padding: 7px 12px;
  }
  .sub-band.employee {
    background: #2A2019;
  }
  .warn-band {
    background: #FEF3C7;
    border: 1px solid #F59E0B;
    color: #92400E;
    font-size: 11px;
    font-weight: 600;
    padding: 8px 12px;
    margin-top: 10px;
  }
  .meta {
    display: grid;
    grid-template-columns: 1.4fr 1fr;
    gap: 16px 24px;
    margin: 18px 0 14px;
    font-size: 12px;
  }
  .meta .label {
    font-size: 10px;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    color: #6B5E54;
    font-weight: 600;
    margin-bottom: 3px;
  }
  .meta .value { font-size: 13px; font-weight: 600; }
  .meta .entity { font-size: 12px; font-weight: 400; color: #6B5E54; margin-top: 2px; }
  table.lines {
    width: 100%;
    border-collapse: collapse;
    font-size: 12px;
    margin-top: 6px;
  }
  table.lines thead th {
    background: #F3F0EB;
    text-align: left;
    font-size: 10px;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    color: #6B5E54;
    padding: 8px 10px;
    border-bottom: 1px solid #E5E0D8;
  }
  table.lines thead th.num,
  table.lines td.num { text-align: right; }
  table.lines td {
    padding: 8px 10px;
    border-bottom: 1px solid #F0EBE4;
  }
  table.lines tr.zebra td { background: #FAF8F4; }
  table.lines tfoot td {
    font-weight: 700;
    background: #F3F0EB;
    border-top: 1px solid #D9D2C8;
    padding: 9px 10px;
  }
  .totals {
    margin-top: 18px;
    width: 300px;
    margin-left: auto;
    font-size: 12px;
  }
  .totals .row {
    display: flex;
    justify-content: space-between;
    padding: 6px 0;
    border-bottom: 1px solid #EEE8E0;
  }
  .totals .row.gross .amt { color: #2E6B57; font-weight: 700; }
  .totals .row.deduction-head {
    margin-top: 8px;
    font-size: 10px;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    color: #6B5E54;
    font-weight: 700;
    border-bottom: none;
    padding-bottom: 2px;
  }
  .totals .net {
    margin-top: 8px;
    background: #1B4F8A;
    color: #fff;
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 12px 14px;
    font-weight: 700;
    letter-spacing: 0.04em;
  }
  .totals .net .amt {
    font-size: 18px;
    font-variant-numeric: tabular-nums;
  }
  .ytd {
    margin-top: 14px;
    padding: 10px 12px;
    background: #FAF8F4;
    border: 1px solid #E5E0D8;
    font-size: 11px;
  }
  .ytd .label {
    font-size: 10px;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    color: #6B5E54;
    font-weight: 700;
    margin-bottom: 6px;
  }
  .ytd-row {
    display: flex;
    justify-content: space-between;
    padding: 3px 0;
  }
  .money { color: #2E6B57; font-variant-numeric: tabular-nums; }
  .footnotes {
    margin-top: 28px;
    padding-top: 12px;
    border-top: 1px solid #E5E0D8;
    font-size: 10px;
    color: #6B5E54;
    line-height: 1.45;
  }
  .footnotes ul { margin: 6px 0 0; padding-left: 16px; }
  .footnotes code { font-size: 10px; }
</style>
</head>
<body>
  <div class="page">
    <div class="header">
      <img class="logo" src="${escapeHtml(payload.logoSrc)}" alt="Rise &amp; Shine" />
      <div class="company">
        <div class="name">Rise &amp; Shine ABA LLC</div>
        <div class="tag">Autism Treatment Center · New York</div>
        <div class="addr">1655 Richmond Ave, Staten Island, NY 10314</div>
      </div>
    </div>

    <div class="band">PAY STATEMENT</div>
    ${subBand}
    ${
      showReconcileWarn
        ? `<div class="warn-band">⚠ Totals don't match line items / deductions — review before relying on this statement.</div>`
        : ''
    }

    <div class="meta">
      <div>
        <div class="label">Pay to</div>
        <div class="value">${payToPrimary}</div>
        ${payToEntity}
      </div>
      <div>
        <div class="label">Pay date</div>
        <div class="value">${escapeHtml(fmtDate(payload.payDate))}</div>
      </div>
      <div>
        <div class="label">Pay period</div>
        <div class="value">${escapeHtml(fmtDate(payload.periodStart))} – ${escapeHtml(fmtDate(payload.periodEnd))}</div>
      </div>
      <div>
        <div class="label">Pay rate</div>
        <div class="value">${escapeHtml(rateLabel)}</div>
      </div>
    </div>

    <table class="lines">
      <thead>
        <tr>
          <th>Date</th>
          <th class="num">Start</th>
          <th class="num">End</th>
          <th class="num">Hours</th>
          <th class="num">Amount</th>
        </tr>
      </thead>
      <tbody>
        ${rows || `<tr><td colspan="5" style="text-align:center;color:#6B5E54;padding:16px">No line items</td></tr>`}
      </tbody>
      <tfoot>
        <tr>
          <td colspan="3">Total Hours</td>
          <td class="num">${totals.totalHours.toFixed(2)}</td>
          <td class="num money">${escapeHtml(formatUsd(grossPay))}</td>
        </tr>
      </tfoot>
    </table>

    <div class="totals">
      <div class="row gross">
        <span>Gross pay</span>
        <span class="amt">${escapeHtml(formatUsd(grossPay))}</span>
      </div>
      ${
        !isContractor && employeeRows.length > 0
          ? `<div class="row deduction-head"><span>Deductions</span><span></span></div>`
          : ''
      }
      ${deductionBlock}
      <div class="net">
        <span>NET PAY</span>
        <span class="amt">${escapeHtml(formatUsd(netPay))}</span>
      </div>
      ${ytdBlock}
    </div>

    <div class="footnotes">
      <strong>Notes</strong>
      <ul>
        ${footnotes}
      </ul>
    </div>
  </div>
</body>
</html>`
}

export function payStubDownloadFilename(
  legalName: string,
  payDate: Date | string
): string {
  const safe = legalName.replace(/[^\w\s.-]+/g, '').trim() || 'Payee'
  const dt = asDate(payDate)
  const y = dt.getUTCFullYear()
  const m = String(dt.getUTCMonth() + 1).padStart(2, '0')
  const day = String(dt.getUTCDate()).padStart(2, '0')
  return `${safe} Pay Statement ${y}-${m}-${day}.pdf`
}
