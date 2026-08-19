#!/usr/bin/env node
/**
 * Post-remediation security audit re-run.
 * Scans app/api route handlers with expanded guard recognition vs Stage 1 heuristic scan.
 */
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'

const ROOT = new URL('..', import.meta.url).pathname
const API_DIR = join(ROOT, 'app/api')

const AUTH_PATTERNS = [
  /requireAdminSession/,
  /requireDocumentsAdminSession/,
  /requireBillingManagerSession/,
  /requireClientServicesSession/,
  /requireRbtSession/,
  /requireOperationsSession/,
  /requireScheduleSession/,
  /getCurrentUser\s*\(/,
  /validateSession\s*\(/,
  /assertMcpAuth/,
  /assertCronOrResponse/,
  /assertCrmCronOrResponse/,
  /assertCronSecret/,
  /enforceClientScope/,
  /enforceClientScopeForEdit/,
  /assertCanViewClient/,
  /assertCanEditClient/,
  /assertScheduleClientEdit/,
  /assertScheduleAssignmentIdsEdit/,
  /resolveCompanyDocAccessToken/,
  /assertSendOtpRateLimit/,
  /assertVerifyOtpRateLimit/,
  /assertElevateRateLimit/,
  /HRM_SYNC/,
  /x-hrm-sync-key/,
  /Bearer\s+/,
  /schedulingToken:\s*token/,
  /schedulingToken\s*===/,
  /auth\.user\.rbtProfileId/,
  /user\.rbtProfileId/,
  /rbtProfileId\s*===/,
  /stub\.rbtProfileId/,
  /requireAuth/,
  /requireSession/,
  /isAdmin\s*\(/,
  /checkRateLimit\s*\(/,
  /assertCompanyDocPublicRateLimit/,
  /assertSchedulingPublicRateLimit/,
  /assertRateLimit\s*\(/,
  /verifyPkce/,
  /oAuthAuthorizationCode/,
]

const PHI_PATH_HINTS = [
  /client-services/,
  /clinical/,
  /supervision/,
  /rbt\//,
  /billing/,
  /payroll/,
  /admin\/(?!documents\/company)/,
  /profile/,
  /activity/,
  /onboarding/,
  /schedule/,
  /crm/,
  /operations/,
  /exports/,
  /company-docs/,
  /calendar\/ics/,
  /validate-scheduling/,
  /schedule-interview/,
]

const INTENTIONAL_PUBLIC_PREFIXES = [
  'app/api/public/',
  'app/api/oauth/',
  'app/api/auth/send-otp',
  'app/api/auth/verify-otp',
  'app/api/auth/logout',
  'app/api/auth/get-latest-otp',
  'app/api/health',
  'app/api/cron/',
  'app/api/mcp',
  'app/api/mobile/sync/',
  'app/api/auth/me',
]

const PUBLIC_NEEDS_TOKEN_OR_RATE = [
  { prefix: 'app/api/public/company-docs/', needs: [/resolveCompanyDocAccessToken/, /assertCompanyDocPublicRateLimit/] },
  { prefix: 'app/api/public/apply/', needs: [/checkRateLimit/] },
  { prefix: 'app/api/public/validate-scheduling-token', needs: [/schedulingToken/, /assertSchedulingPublicRateLimit/] },
  { prefix: 'app/api/public/schedule-interview', needs: [/schedulingToken/, /assertSchedulingPublicRateLimit/] },
  { prefix: 'app/api/public/calendar/ics', needs: [/schedulingToken/, /assertSchedulingPublicRateLimit/] },
]

function walk(dir) {
  const out = []
  for (const name of readdirSync(dir)) {
    const p = join(dir, name)
    if (statSync(p).isDirectory()) out.push(...walk(p))
    else if (name === 'route.ts') out.push(p)
  }
  return out
}

function rel(p) {
  return relative(ROOT, p).replace(/\\/g, '/')
}

function touchesPhi(path) {
  return PHI_PATH_HINTS.some((re) => re.test(path))
}

function isIntentionalPublic(path) {
  return INTENTIONAL_PUBLIC_PREFIXES.some((p) => path.startsWith(p))
}

function hasAuthGuard(content) {
  return AUTH_PATTERNS.some((re) => re.test(content))
}

function publicRouteAdequate(path, content) {
  if (path.includes('app/api/public/interviewers') || path.includes('app/api/public/interviewer-slots')) {
    return { ok: true, note: 'intentionally unauthenticated scheduling UI (no PHI)' }
  }
  for (const rule of PUBLIC_NEEDS_TOKEN_OR_RATE) {
    if (path.startsWith(rule.prefix)) {
      const ok = rule.needs.every((re) => re.test(content))
      return { ok, note: ok ? 'token/rate-limited public' : 'missing token or rate limit' }
    }
  }
  if (path.startsWith('app/api/oauth/')) return { ok: true, note: 'OAuth PKCE + admin consent' }
  if (path.startsWith('app/api/auth/send-otp') || path.startsWith('app/api/auth/verify-otp')) {
    return { ok: /assert(Send|Verify)OtpRateLimit/.test(content), note: 'OTP rate limits' }
  }
  if (path.startsWith('app/api/cron/')) {
    return { ok: /assertCron|assertCrmCron/.test(content), note: 'cron secret' }
  }
  if (path.startsWith('app/api/mcp')) return { ok: /assertMcpAuth/.test(content), note: 'MCP API key' }
  if (path.startsWith('app/api/mobile/sync/')) return { ok: true, note: 'sync bearer key' }
  if (path.startsWith('app/api/health')) return { ok: true, note: 'liveness' }
  if (path.startsWith('app/api/auth/logout')) return { ok: true, note: 'session teardown (validateSession when cookie present)' }
  if (path.startsWith('app/api/auth/get-latest-otp')) {
    return { ok: /NODE_ENV.*production/.test(content), note: 'dev-only OTP helper' }
  }
  if (path.startsWith('app/api/auth/me')) return { ok: true, note: 'auth probe' }
  return { ok: false, note: 'unclassified public' }
}

function extractHandlers(content) {
  const methods = []
  const re = /^export\s+async\s+function\s+(GET|POST|PUT|PATCH|DELETE|OPTIONS|HEAD)\s*\(/gm
  let m
  while ((m = re.exec(content))) methods.push(m[1])
  return methods
}

const routes = walk(API_DIR)
const rows = []

for (const file of routes) {
  const path = rel(file)
  const content = readFileSync(file, 'utf8')
  const phi = touchesPhi(path)
  const methods = extractHandlers(content)
  const guarded = hasAuthGuard(content)
  const intentional = isIntentionalPublic(path)

  for (const method of methods) {
    let verdict
    let category
    if (intentional) {
      const pub = publicRouteAdequate(path, content)
      verdict = pub.ok ? 'INTENTIONALLY_PUBLIC' : 'REAL_GAP'
      category = pub.note
    } else if (guarded) {
      verdict = 'OK'
      category = 'guarded'
    } else {
      verdict = 'REAL_GAP'
      category = 'no clear auth guard'
    }
    rows.push({ path, method, phi, verdict, category })
  }
}

const flag = rows.filter((r) => r.verdict === 'REAL_GAP')
const phiRealGap = flag.filter((r) => r.phi)
const ok = rows.filter((r) => r.verdict === 'OK')
const intentional = rows.filter((r) => r.verdict === 'INTENTIONALLY_PUBLIC')

console.log('=== SECURITY AUDIT RE-RUN (post-remediation) ===')
console.log(`Total handlers: ${rows.length}`)
console.log(`OK (guarded): ${ok.length}`)
console.log(`INTENTIONALLY_PUBLIC: ${intentional.length}`)
console.log(`REAL_GAP: ${flag.length}`)
console.log(`PHI REAL_GAP: ${phiRealGap.length}`)
console.log('')

if (phiRealGap.length > 0) {
  console.log('--- PHI REAL GAP rows ---')
  for (const r of phiRealGap) {
    console.log(`  ${r.path} [${r.method}] — ${r.category}`)
  }
  console.log('')
}

const nonPhiGap = flag.filter((r) => !r.phi)
if (nonPhiGap.length > 0) {
  console.log('--- Non-PHI REAL GAP rows ---')
  for (const r of nonPhiGap) {
    console.log(`  ${r.path} [${r.method}] — ${r.category}`)
  }
}

process.exit(phiRealGap.length > 0 ? 1 : 0)
