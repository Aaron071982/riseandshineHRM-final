/** Relative return paths allowed after admin login for OAuth consent. */
export function isSafeOAuthReturnUrl(path: string): boolean {
  if (!path || !path.startsWith('/api/oauth/authorize')) return false
  if (path.includes('://') || path.startsWith('//')) return false
  return true
}

export const OAUTH_RETURN_URL_KEY = 'oauthReturnUrl'

/** RBT portal deep links (e.g. the I-9 page from an email) to resume after login. */
export const RBT_RETURN_PATH_KEY = 'rbtReturnPath'

export function isSafeRbtReturnPath(path: string): boolean {
  return /^\/rbt\/[a-z0-9/-]+$/i.test(path) && !path.includes('//')
}
