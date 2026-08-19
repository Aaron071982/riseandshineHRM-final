/**
 * Universal write-script safety: print the target host, default to dry-run,
 * and refuse production unless an explicit prod-confirm flag is present.
 */

export type WriteFlags = {
  confirm: boolean
  prodConfirm: boolean
  dryRun: boolean
}

export type TargetClass = {
  host: string
  isDev: boolean
}

export type WriteTarget = TargetClass & WriteFlags & {
  url: string
}

export function dbHostFromUrl(url: string): string {
  try {
    return new URL(url).hostname || 'unknown'
  } catch {
    return url.split('@')[1]?.split('/')[0] ?? 'unknown'
  }
}

export function parseWriteFlags(argv: string[] = process.argv.slice(2)): WriteFlags {
  const confirm = argv.includes('--confirm')
  const prodConfirm =
    argv.includes('--prod-confirm') || argv.includes('--allow-prod')
  return { confirm, prodConfirm, dryRun: !confirm }
}

export function classifyDatabaseTarget(
  url: string,
  devRef = process.env.DEV_SUPABASE_REF?.trim() ?? ''
): TargetClass {
  const host = dbHostFromUrl(url)
  const isDev = !!devRef && url.includes(devRef)
  return { host, isDev }
}

export function shouldRefuseNonDev(isDev: boolean, prodConfirm: boolean): boolean {
  return !isDev && !prodConfirm
}

export type AssertWriteTargetOptions = {
  /**
   * When false (default), non-dev targets are always refused — even with
   * --prod-confirm. Use this for seed / wipe scripts that must never hit prod.
   */
  allowProd?: boolean
  /**
   * When true (default), `--confirm` is required to write. Set false for
   * helpers that only gate the target (legacy assertDevTarget).
   */
  requireConfirm?: boolean
  /** Override argv (tests). */
  argv?: string[]
  /** Override DATABASE_URL (tests). */
  databaseUrl?: string
  /** If true, exit the process on refusal (default). Tests set false. */
  exit?: boolean
}

export class WriteTargetError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'WriteTargetError'
  }
}

/**
 * Call at the top of every script that can write to the DB.
 * Prints the target host. Defaults to dry-run unless `--confirm`.
 * Refuses non-dev unless `--prod-confirm` (or `--allow-prod`) and allowProd.
 */
export function assertWriteTarget(
  opts: AssertWriteTargetOptions = {}
): WriteTarget {
  const allowProd = opts.allowProd === true
  const flags = parseWriteFlags(opts.argv)
  const requireConfirm = opts.requireConfirm !== false
  const dryRun = requireConfirm ? flags.dryRun : false
  const url = opts.databaseUrl ?? process.env.DATABASE_URL ?? ''
  const classified = classifyDatabaseTarget(url)
  const exit = opts.exit !== false

  console.log(`→ Target DB host: ${classified.host}`)
  console.log(`→ Mode: ${dryRun ? 'DRY RUN (no writes)' : 'WRITE'}`)

  if (!url) {
    const msg = '✋ DATABASE_URL is unset — refusing to run.'
    if (exit) {
      console.error(msg)
      process.exit(1)
    }
    throw new WriteTargetError(msg)
  }

  if (!classified.isDev) {
    if (!allowProd || shouldRefuseNonDev(classified.isDev, flags.prodConfirm)) {
      const msg =
        `✋ Refusing to run against a non-dev database.\n` +
        `   Target host: ${classified.host}\n` +
        `   Expected DEV_SUPABASE_REF: ${process.env.DEV_SUPABASE_REF || '(unset)'}\n` +
        (allowProd
          ? '   Pass --prod-confirm (and --confirm to write) to proceed against prod.'
          : '   This script is not allowed against prod.')
      if (exit) {
        console.error(msg)
        process.exit(1)
      }
      throw new WriteTargetError(msg)
    }
    console.log('⚠ Prod target explicitly confirmed via --prod-confirm')
  } else {
    console.log(`✓ Dev target confirmed: ${classified.host}`)
  }

  return { url, ...classified, ...flags, dryRun }
}

/** Back-compat: refuse prod, allow write (caller already opted in by running). */
export function assertDevTarget(): WriteTarget {
  return assertWriteTarget({ allowProd: false, requireConfirm: false })
}
