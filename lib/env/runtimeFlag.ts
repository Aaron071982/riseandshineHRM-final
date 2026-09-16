/**
 * Read a boolean server env flag at runtime.
 * Dynamic process.env[key] access avoids Next.js build-time inlining (see Next 14).
 *
 * Truthy: true, yes, 1, on, enabled (any case / surrounding whitespace).
 * Falsy: unset, empty, false, no, 0, off, disabled, or any other value.
 */
export function runtimeEnvFlag(name: string): boolean {
  const raw = process.env[name]
  if (raw == null || raw === '') return false
  const v = raw.trim().toLowerCase()
  return v === 'true' || v === 'yes' || v === '1' || v === 'on' || v === 'enabled'
}

/** Explicit false/no/0/off/disabled (any case). */
export function runtimeEnvFlagExplicitlyFalse(name: string): boolean {
  const raw = process.env[name]
  if (raw == null || raw === '') return false
  const v = raw.trim().toLowerCase()
  return v === 'false' || v === 'no' || v === '0' || v === 'off' || v === 'disabled'
}
