<!-- 30bc10e4-c59d-4921-98b5-c8febab09cef a5721e3e-994a-4255-88c4-c59eed0c0770 -->
# Debug RBT Dashboard 500 Error

## Problem

The `/rbt/dashboard` route is crashing in production with a 500 error. The error message doesn't reveal the root cause - need to add error handling to identify it.

## Root Cause Analysis

This project uses **Prisma** (not Supabase JS client) to connect to Supabase Postgres. The crash is likely:

1. Missing/incorrect `DATABASE_URL` environment variable in Vercel
2. Prisma connection failure (P1001: Can't reach database server)
3. Unhandled Prisma query errors
4. Session validation failing due to DB connection

## Implementation Plan

### 1. Add Error Handling to RBT Dashboard Page

- Wrap all Prisma queries in try-catch blocks in `app/rbt/dashboard/page.tsx`
- Add environment variable validation at the top
- Log detailed error information (without secrets) to console
- Return user-friendly error pages instead of crashing
- Check for DATABASE_URL presence and log status

### 2. Enhance Prisma Error Handling

- Update `lib/prisma.ts` to add more detailed error logging
- Log connection attempts and failures with metadata
- Add fallback error messages

### 3. Add Environment Variable Checks

- Verify `DATABASE_URL` is set in production
- Log which environment variables are present (booleans only, no values)
- Provide clear error messages if env vars are missing

### 4. Create Debug Helper

- Add a helper function to safely log error details
- Include error type, message, and stack trace (if available)
- Exclude sensitive information from logs

### 5. Test Locally

- Test with missing DATABASE_URL to verify error handling
- Test with invalid DATABASE_URL to catch connection errors
- Ensure graceful degradation

### 6. Document Vercel Log Checking Steps

- Provide instructions for accessing Vercel deployment logs
- Explain how to filter for `/rbt/dashboard` errors
- Guide user on what to look for in logs

## Files to Modify

- `app/rbt/dashboard/page.tsx` - Add comprehensive error handling
- `lib/prisma.ts` - Enhance error logging (optional, may already be good)

## Expected Outcomes

1. Production error will show detailed logs in Vercel instead of generic 500
2. User will see a helpful error page instead of a blank crash
3. Root cause can be identified from logs (env vars, connection, query errors)
4. Can then apply targeted fix based on actual error