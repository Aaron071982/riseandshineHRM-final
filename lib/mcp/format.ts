import type { ReportResult } from '@/lib/operations/reports'
import type { ToolResult } from '@/lib/mcp/types'

export function paginate<T>(
  items: T[],
  limit = 25,
  cursor?: string | null
): { page: T[]; nextCursor: string | null; total: number } {
  const safeLimit = Math.min(Math.max(limit, 1), 100)
  const offset = cursor ? Math.max(parseInt(cursor, 10) || 0, 0) : 0
  const page = items.slice(offset, offset + safeLimit)
  const nextOffset = offset + page.length
  const nextCursor =
    nextOffset < items.length ? String(nextOffset) : null
  return { page, nextCursor, total: items.length }
}

export function reportToToolResult(report: ReportResult): ToolResult {
  const header = report.columns.map((c) => c.header).join(' | ')
  const lines = report.rows.map((row) =>
    report.columns
      .map((c) => {
        const v = row[c.key]
        return v == null ? '—' : String(v)
      })
      .join(' | ')
  )

  const text = [
    `# ${report.title}`,
    '',
    report.summary,
    '',
    header,
    lines.length ? lines.join('\n') : '(no rows)',
  ].join('\n')

  return {
    text,
    summary: {
      reportKey: report.key,
      rowCount: report.rows.length,
      refreshedAt: report.refreshedAt,
    },
  }
}

export function jsonToolResult(
  title: string,
  payload: unknown,
  summary: Record<string, unknown> = {}
): ToolResult {
  return {
    text: `# ${title}\n\n\`\`\`json\n${JSON.stringify(payload, null, 2)}\n\`\`\``,
    summary,
  }
}
