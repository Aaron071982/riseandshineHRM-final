/** Shared CSV helpers for client import / scrub scripts. */

/** Minimal RFC4180 parser that preserves multiline quoted fields. */
export function parseCsv(text: string): { headers: string[]; rows: string[][] } {
  const rows: string[][] = []
  let row: string[] = []
  let field = ''
  let i = 0
  let inQuotes = false

  const pushField = () => {
    row.push(field)
    field = ''
  }
  const pushRow = () => {
    if (row.length === 1 && row[0] === '' && rows.length > 0) {
      row = []
      return
    }
    rows.push(row)
    row = []
  }

  while (i < text.length) {
    const c = text[i]!
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          field += '"'
          i += 2
          continue
        }
        inQuotes = false
        i++
        continue
      }
      field += c
      i++
      continue
    }
    if (c === '"') {
      inQuotes = true
      i++
      continue
    }
    if (c === ',') {
      pushField()
      i++
      continue
    }
    if (c === '\r') {
      i++
      continue
    }
    if (c === '\n') {
      pushField()
      pushRow()
      i++
      continue
    }
    field += c
    i++
  }
  if (field.length > 0 || row.length > 0) {
    pushField()
    pushRow()
  }

  if (rows.length === 0) return { headers: [], rows: [] }
  const headers = rows[0]!.map((h) => h.trim())
  return { headers, rows: rows.slice(1) }
}

export function toCsv(headers: string[], rows: string[][]): string {
  const esc = (v: string) => {
    if (/[",\n\r]/.test(v)) return `"${v.replace(/"/g, '""')}"`
    return v
  }
  const lines = [headers.map(esc).join(',')]
  for (const r of rows) {
    lines.push(headers.map((_, i) => esc(r[i] ?? '')).join(','))
  }
  return lines.join('\n') + '\n'
}
