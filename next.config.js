/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  images: {
    domains: ['localhost'],
  },
  // Domain redirect (non-www → www) is configured in Vercel → Domains, not here.
  // OAuth and public links use getPublicBaseUrl() → https://www.riseandshinehrm.com
}

module.exports = nextConfig

