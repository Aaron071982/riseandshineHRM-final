/** @type {import('next').NextConfig} */

// Content-Security-Policy is report-only until violations are reviewed in the browser console /
// your CSP reporting endpoint. To enforce, rename the header key below from
// Content-Security-Policy-Report-Only to Content-Security-Policy.
//
// TODO: flip to Content-Security-Policy after N days of clean reports in production/preview.
// Before flipping, verify zero violations for:
//   - Mapbox (api.mapbox.com, events, workers, styles, tiles)
//   - Resend (api.resend.com — server-side only; should not appear in browser CSP)
//   - Supabase (*.supabase.co storage/auth if any client SDK)
//   - Next.js inline scripts / styles ('unsafe-inline' / 'unsafe-eval' currently required)
//   - CDN assets (cdn.jsdelivr.net for Mapbox GL)
// Go-live checklist: review Report-Only console noise for 7+ days, then flip deliberately —
// do not auto-enforce in a phase change.
const contentSecurityPolicy = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://api.mapbox.com https://cdn.jsdelivr.net",
  "style-src 'self' 'unsafe-inline' https://api.mapbox.com",
  "img-src 'self' data: blob: https:",
  "font-src 'self' data:",
  "connect-src 'self' https://api.mapbox.com https://*.supabase.co https://api.resend.com https://cdn.jsdelivr.net",
  "worker-src 'self' blob: https://cdn.jsdelivr.net",
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'",
].join('; ')

const securityHeaders = [
  {
    key: 'Strict-Transport-Security',
    value: 'max-age=63072000; includeSubDomains; preload',
  },
  {
    key: 'X-Frame-Options',
    value: 'DENY',
  },
  {
    key: 'X-Content-Type-Options',
    value: 'nosniff',
  },
  {
    key: 'Referrer-Policy',
    value: 'strict-origin-when-cross-origin',
  },
  {
    key: 'Permissions-Policy',
    value: 'camera=(), microphone=(), geolocation=()',
  },
  {
    key: 'X-DNS-Prefetch-Control',
    value: 'on',
  },
  {
    key: 'Content-Security-Policy-Report-Only',
    value: contentSecurityPolicy,
  },
]

const nextConfig = {
  reactStrictMode: true,
  images: {
    domains: ['localhost'],
  },
  experimental: {
    // Keep parent form PDFs available to serverless functions that attach them.
    outputFileTracingIncludes: {
      '/api/public/parent-forms/[slug]': [
        './public/parent-forms/**/*',
        './email-docs/**/*',
        './assets/crm-parent-forms/**/*',
      ],
      '/*': [
        './public/parent-forms/**/*',
        './email-docs/**/*',
        './assets/crm-parent-forms/**/*',
      ],
    },
  },
  async headers() {
    return [
      {
        source: '/:path*',
        headers: securityHeaders,
      },
    ]
  },
  // Domain redirect (non-www → www) is configured in Vercel → Domains, not here.
  // OAuth and public links use getPublicBaseUrl() → https://www.riseandshinehrm.com
}

module.exports = nextConfig
