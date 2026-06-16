/** Relative return paths allowed after admin login for OAuth consent. */
export function isSafeOAuthReturnUrl(path: string): boolean {
  if (!path || !path.startsWith('/api/oauth/authorize')) return false
  if (path.includes('://') || path.startsWith('//')) return false
  return true
}

export const OAUTH_RETURN_URL_KEY = 'oauthReturnUrl'
