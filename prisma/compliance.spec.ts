// NOTE: This is a lightweight, non-executed specification file describing
// how to test the new ABA compliance layer once a test runner is added.
//
// It is intentionally not wired to any specific framework (Jest/Vitest)
// to avoid adding dependencies without your approval.
//
// Suggested high-value tests:
//
// 1) Document / credential expiration alerts
// - Seed an Employee with one EmploymentDocument and one Credential where
//   expiresAt is within 7 days, 30 days, and already past.
// - Call runExpirationEngine(now) with a fixed "today" and assert:
//   - EmploymentDocument.status is set to EXPIRED when expiresAt < today.
//   - ComplianceAlert rows exist for DOC_EXPIRING and CREDENTIAL_EXPIRING
//     with correct severity (WARN vs BLOCKER) and dueAt.
//
// 2) Supervision 5% rule
// - Seed an Employee of type RBT with ClinicalServiceLog rows totalling e.g.
//   1000 minutes and SupervisionEvent rows totalling 40 minutes.
// - Call runSupervisionComplianceEngine() for that month and assert:
//   - A ComplianceAlert of type UNDER_SUPERVISION_5_PERCENT exists.
//   - Severity is WARN if the month is not finished, BLOCKER if it is.
//
// 3) Authorization exhaustion
// - Seed a Client + PayerAuthorization with unitsAuthorized = 10 and
//   unitsUsed = 9, then insert a billable ClinicalServiceLog with units = 2.
// - Verify unitsUsed increments to 11 and that an AUTH_EXHAUSTED alert is written.
//
// 4) RBAC guards
// - For each new API route, call with:
//   - No session cookie → expect 401.
//   - RBT user where only ADMIN is allowed → expect 403.
//   - ADMIN user → expect 200 and correct behaviour.
//
// 5) Audit logging
// - For document/credential/log/supervision creates and updates, assert that
//   an AuditLog row is created with the correct actorUserId, entityType,
//   entityId, and diff.before/after shape.
//
// Once you introduce a test runner, these scenarios can be converted into
// executable tests by importing:
//   - prisma from '@/lib/prisma'
//   - runExpirationEngine from '@/lib/compliance/expiration'
//   - runSupervisionComplianceEngine from '@/lib/compliance/supervision'
// and running them against a disposable database schema.

