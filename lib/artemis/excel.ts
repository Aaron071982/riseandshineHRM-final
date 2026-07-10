import ExcelJS from 'exceljs'

function cellValue(cell: ExcelJS.Cell): unknown {
  const v = cell.value
  if (v == null) return ''
  if (typeof v === 'object' && 'result' in v) return (v as { result: unknown }).result ?? ''
  if (typeof v === 'object' && 'text' in v) return (v as { text: string }).text ?? ''
  if (v instanceof Date) return v
  return v
}

/** Convert the first worksheet to a 2-D array (AOA) for lib/artemis/parse.ingest. */
export function worksheetToAoa(sheet: ExcelJS.Worksheet): unknown[][] {
  const aoa: unknown[][] = []
  sheet.eachRow({ includeEmpty: true }, (row) => {
    const cells: unknown[] = []
    row.eachCell({ includeEmpty: true }, (cell, colNumber) => {
      while (cells.length < colNumber - 1) cells.push('')
      cells[colNumber - 1] = cellValue(cell)
    })
    aoa.push(cells)
  })
  return aoa
}

export async function workbookBufferToAoa(buf: Buffer): Promise<unknown[][]> {
  const workbook = new ExcelJS.Workbook()
  await workbook.xlsx.load(buf as unknown as ExcelJS.Buffer)
  const sheet = workbook.worksheets[0]
  if (!sheet) return []
  return worksheetToAoa(sheet)
}
