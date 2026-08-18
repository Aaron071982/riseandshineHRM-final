/**
 * Pure idle/absolute expiry check for Client Services elevated sessions.
 * Exported for unit tests — validateElevatedSession uses the same rules.
 */
export function isElevatedSessionExpired(params: {
  nowMs: number
  lastActiveAtMs: number
  createdAtMs: number
  expiresAtMs: number
  idleMs: number
  absoluteMs: number
}): boolean {
  const idle = params.nowMs - params.lastActiveAtMs
  const absolute = params.nowMs - params.createdAtMs
  return (
    idle >= params.idleMs ||
    absolute >= params.absoluteMs ||
    params.expiresAtMs <= params.nowMs
  )
}
