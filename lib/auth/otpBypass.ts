/** True when OTP dev/test bypasses are allowed (never on production hosts). */
export function isOtpBypassEnvironment(hostname: string): boolean {
  const isLocalhostHost = hostname === 'localhost' || hostname === '127.0.0.1'
  const isNonProdEnv = process.env.NODE_ENV !== 'production'
  return isNonProdEnv || isLocalhostHost
}
