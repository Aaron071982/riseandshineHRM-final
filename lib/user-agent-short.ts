/** Human-readable short device string for certificates and admin UI. */
export function formatUserAgentShort(ua: string | null | undefined): string {
  if (!ua || ua === 'unknown') return 'Unknown device'
  let browser = 'Browser'
  if (/Edg\//.test(ua)) browser = 'Edge'
  else if (/Chrome\//.test(ua)) browser = 'Chrome'
  else if (/Firefox\//.test(ua)) browser = 'Firefox'
  else if (/Safari\//.test(ua) && !/Chrome/.test(ua)) browser = 'Safari'

  let device = ''
  if (/iPhone/.test(ua)) device = 'iPhone'
  else if (/iPad/.test(ua)) device = 'iPad'
  else if (/Android/.test(ua)) device = 'Android'
  else if (/Macintosh|Mac OS X/.test(ua)) device = 'Mac'
  else if (/Windows/.test(ua)) device = 'Windows'

  if (device) return `${browser} on ${device}`
  return browser
}
