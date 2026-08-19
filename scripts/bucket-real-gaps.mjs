import fs from 'fs'

const text = fs.readFileSync('docs/SECURITY_REMEDIATION_PLAN.md', 'utf8')
const rows = [...text.matchAll(/\| `([^`]+)` \| (\w+) \| (\w+) \| REAL GAP \|/g)]

function bucket(path) {
  if (
    path.includes('/api/public/') ||
    path.includes('/api/oauth/') ||
    path.includes('/api/auth/send-otp') ||
    path.includes('/api/auth/verify-otp') ||
    path.includes('/api/auth/logout') ||
    path.includes('/api/auth/get-latest-otp') ||
    path.includes('/api/health')
  )
    return 'E'
  if (
    path.includes('/api/client-services/') ||
    path.includes('/api/clinical/') ||
    path.includes('/api/supervision/')
  )
    return 'A'
  if (
    path.includes('/api/admin/') ||
    path.includes('/api/billing/') ||
    path.includes('/api/exports/') ||
    path.includes('/api/operations/') ||
    path.includes('/api/debug/') ||
    path.includes('/api/hr-tasks/')
  )
    return 'B'
  if (path.includes('/api/rbt/') || path.includes('/api/mobile/') || path.includes('/api/profile/'))
    return 'C'
  return 'D'
}

const counts = { A: 0, B: 0, C: 0, D: 0, E: 0 }
const phi = { A: 0, B: 0, C: 0, D: 0, E: 0 }
const byBucket = { A: [], B: [], C: [], D: [], E: [] }

for (const m of rows) {
  const b = bucket(m[1])
  counts[b]++
  if (m[3] === 'yes') phi[b]++
  byBucket[b].push(`${m[1]} [${m[2]}]`)
}

console.log('counts', counts, 'total', Object.values(counts).reduce((a, b) => a + b, 0))
console.log('phi', phi)
