# Fix Interview Scheduling Domain Configuration

## Goal

Ensure all candidate-facing scheduling links in emails use the canonical production domain `https://riseandshinehrm.com`, with no redirects to Vercel preview URLs or account creation requirements.

## Current Problem

- Email links may use `VERCEL_URL` which can point to preview deployments (*.vercel.app)
- Candidates should never land on Vercel preview URLs from emails
- The `/schedule-interview` route and public APIs must be accessible without authentication

## Implementation Plan

### PART A — Canonical Base URL Helper

**File: `lib/baseUrl.ts` (NEW)**

Create a single source of truth for public-facing URLs:

```typescript
/**
 * Gets the canonical base URL for public-facing links.
 * - Uses NEXT_PUBLIC_BASE_URL if set (full URL like "https://riseandshinehrm.com")
 * - In production, defaults to "https://riseandshinehrm.com" (canonical domain)
 * - In development, defaults to "http://localhost:3000"
 * 
 * NEVER uses VERCEL_URL for candidate-facing links.
 */
export function getPublicBaseUrl(): string {
  if (process.env.NEXT_PUBLIC_BASE_URL) {
    return process.env.NEXT_PUBLIC_BASE_URL
  }
  
  if (process.env.NODE_ENV === 'production') {
    return 'https://riseandshinehrm.com'
  }
  
  return 'http://localhost:3000'
}

/**
 * Creates a full URL from a path.
 * @param path Path with leading slash (e.g., "/schedule-interview")
 * @returns Full URL (e.g., "https://riseandshinehrm.com/schedule-interview")
 */
export function makePublicUrl(path: string): string {
  if (!path.startsWith('/')) {
    throw new Error('Path must start with /')
  }
  return `${getPublicBaseUrl()}${path}`
}
```

### PART B — Update Email Link Generation

**File: `lib/email.ts`**

Replace all `VERCEL_URL` usage with the new helper functions:

1. **`generateReachOutEmail` (line ~167-170)**
   - Replace current baseUrl logic with `makePublicUrl('/schedule-interview?token=...&rbtId=...')`
   - This is CRITICAL - candidate-facing scheduling link

2. **`generateOfferEmail` (line ~470-471)**
   - Remove unused `portalUrl` variable (email already hardcodes domain on line 589)
   - Or update to use helper if needed

3. **`generateApplicationSubmissionInternalEmail` (line ~708-709)**
   - Replace VERCEL_URL usage with helper (admin-facing, but should use canonical URL)
   - Use `makePublicUrl(`/admin/rbts/${rbtProfile.id}`)`

4. **Search entire file for any other VERCEL_URL usage**
   - Replace all candidate-facing links
   - Admin links should also use canonical domain for consistency

### PART C — Verify Public Routes and APIs

**File: `middleware.ts`**

Verify (already correct, but confirm):
- `/schedule-interview` is in `publicRoutes` array (line 8) ✓
- `/apply` is in `publicRoutes` array ✓
- `/login` is in `publicRoutes` array ✓
- `/api/public/*` routes are allowed (line 12) ✓

No changes needed - middleware is already correct.

**API Routes (verify no auth required):**

1. **`app/api/public/validate-scheduling-token/route.ts`**
   - ✓ Already has no auth checks
   - ✓ Returns JSON responses (no redirects)

2. **`app/api/public/schedule-interview/route.ts`**
   - ✓ Already has no auth checks
   - ✓ Returns JSON responses (no redirects)

No changes needed - APIs are already public.

### PART D — Environment Configuration

**File: `.env.example` (NEW if doesn't exist, or UPDATE if exists)**

Add:
```env
# Canonical production domain for public-facing links
# Set this in Vercel production environment variables
NEXT_PUBLIC_BASE_URL=https://riseandshinehrm.com
```

**Documentation note:**
- In Vercel production environment variables, set: `NEXT_PUBLIC_BASE_URL=https://riseandshinehrm.com`
- Even if this is missing, production code will default to `https://riseandshinehrm.com`

### PART E — Testing Checklist

1. **Development environment:**
   - Links should point to `http://localhost:3000`
   - Test scheduling link generation

2. **Production build:**
   - Links should point to `https://riseandshinehrm.com` even if `VERCEL_URL` exists
   - Verify email link format: `https://riseandshinehrm.com/schedule-interview?token=XXX&rbtId=YYY`

3. **Public access test:**
   - Open scheduling link in incognito browser
   - Page loads without login requirement
   - Token validates correctly
   - Scheduling form submits successfully
   - Interview is created in database
   - No external redirects or account prompts

## Files to Modify

1. ✅ `lib/baseUrl.ts` - Create new helper module
2. ✅ `lib/email.ts` - Replace VERCEL_URL usage with helper functions
3. ✅ `.env.example` - Add NEXT_PUBLIC_BASE_URL documentation
4. ✅ `middleware.ts` - Verify public routes (no changes needed)
5. ✅ API routes - Verify public access (no changes needed)

## Implementation Notes

- Keep the existing token-based scheduling system exactly as-is
- This task is purely about canonical domain links + ensuring public routing access
- All candidate-facing links MUST use production domain
- Admin-facing links should also use canonical domain for consistency
- Development should still work with localhost

## Success Criteria

- ✅ All scheduling links use `https://riseandshinehrm.com` in production
- ✅ No VERCEL_URL usage in candidate-facing email links
- ✅ Development environment uses localhost
- ✅ Public routes accessible without authentication
- ✅ Build passes successfully
- ✅ Complete scheduling flow works end-to-end
