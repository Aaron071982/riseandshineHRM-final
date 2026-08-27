/**
 * Read a boolean server env flag at runtime.
 * Dynamic process.env[key] access avoids Next.js build-time inlining (see Next 14).
 */
export function runtimeEnvFlag(name: string): boolean {
  const raw = process.env[name]
  if (raw == null || raw === '') return false
  return raw.trim().toLowerCase() === 'true'
}
