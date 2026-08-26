export function csvEscape(v: string | number | null | undefined): string {
  const s = v == null ? '' : String(v)
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`
  return s
}

export function rowsToCsv(
  columns: { key: string; header: string }[],
  rows: Record<string, string | number | null | undefined>[]
): string {
  const header = columns.map((c) => csvEscape(c.header)).join(',')
  const body = rows
    .map((row) => columns.map((c) => csvEscape(row[c.key])).join(','))
    .join('\n')
  return `${header}\n${body}`
}

export function median(nums: number[]): number | null {
  if (!nums.length) return null
  const sorted = [...nums].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  if (sorted.length % 2 === 0) {
    return Math.round(((sorted[mid - 1]! + sorted[mid]!) / 2) * 10) / 10
  }
  return sorted[mid]!
}
