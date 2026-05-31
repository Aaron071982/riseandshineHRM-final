export function prismaErrorMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err)
}

export function prismaErrorCode(err: unknown): string | undefined {
  return (err as { code?: string })?.code
}

/** True when Postgres/Prisma reports a missing column (not a missing table). */
export function isMissingColumnError(err: unknown, column?: string): boolean {
  const msg = prismaErrorMessage(err)
  if (column && !msg.includes(column)) return false
  return (
    msg.includes('does not exist') &&
    (msg.includes('column') || msg.includes('Column'))
  )
}

/** True when the named table does not exist. */
export function isMissingTableError(err: unknown, table?: string): boolean {
  const msg = prismaErrorMessage(err)
  const code = prismaErrorCode(err)
  if (table && msg.includes('column')) return false
  if (table && !msg.includes(table)) return false
  return (
    code === 'P2021' ||
    (msg.includes('does not exist') && !msg.includes('column'))
  )
}

export function migrationHintForAcknowledgmentError(err: unknown): string | undefined {
  if (isMissingTableError(err, 'signature_certificates')) {
    return 'Run prisma/scripts/esign-compliance-migration.sql in Supabase (same project as DATABASE_URL).'
  }
  if (isMissingColumnError(err)) {
    return 'Run prisma/scripts/esign-compliance-migration.sql in Supabase to add signature audit columns.'
  }
  return undefined
}
