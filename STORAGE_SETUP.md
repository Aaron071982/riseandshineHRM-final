# Supabase Storage Setup for Public Applications

## Storage Bucket Configuration

### 1. Create the `resumes` bucket

In your Supabase Dashboard:
1. Go to **Storage** → **Buckets**
2. Click **New Bucket**
3. Name: `resumes`
4. Public: **No** (private bucket)
5. File size limit: 10 MB (recommended)
6. Allowed MIME types: `application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document`

### 2. Storage Policies

The `resumes` bucket should have the following policies:

#### Policy 1: Server-side upload only (via service role)
- **Name**: Allow server-side uploads
- **Target roles**: `service_role` (applied automatically for server-side operations)
- **Operation**: INSERT
- **Policy definition**: 
  ```sql
  (bucket_id = 'resumes'::text)
  ```
- Note: This is automatically enabled for service role operations in server-side code

#### Policy 2: Admin download (authenticated admins)
- **Name**: Allow admin downloads
- **Target roles**: `authenticated`
- **Operation**: SELECT
- **Policy definition**:
  ```sql
  (bucket_id = 'resumes'::text)
  ```
- Note: This allows authenticated admin users to download resumes via the admin API endpoint

#### Policy 3: No public access
- **Name**: Deny public access
- **Target roles**: `anon`, `public`
- **Operation**: SELECT
- **Policy definition**: Empty or no policy (default denies)
- Note: The bucket is private, so by default no public access is allowed

### 3. Implementation Details

The current implementation uses **server-side uploads** via the service role:

- Uploads are handled by `/api/public/apply/upload`
- Uses `supabaseAdmin` (service role client) to upload files
- Files are stored with paths: `drafts/{token}/{filename}` or `temp/{filename}`
- Storage path is stored in the database (not public URL)
- Admin downloads are handled by `/api/admin/rbts/[id]/resume`
- Uses `supabaseAdmin` to download files and serve them to authenticated admins

### 4. Security Considerations

- ✅ Bucket is private (not public)
- ✅ No direct public URLs exposed
- ✅ Uploads require server-side processing (service role)
- ✅ Downloads require admin authentication
- ✅ File type validation on upload (PDF, DOC, DOCX only)
- ✅ File size limit (10MB)
- ✅ Filenames are sanitized

### 5. Testing

After setup:
1. Upload a resume via `/apply` form
2. Verify file appears in Supabase Storage under `resumes` bucket
3. Verify admin can download resume via `/admin/rbts/[id]`
4. Verify public cannot access resume URLs directly

---

## Onboarding documents bucket (`onboarding-documents`)

Used for signed/filled onboarding PDFs (e-sign completions). Defined in [`lib/constants.ts`](lib/constants.ts) as `STORAGE_BUCKET`.

### 1. Create the bucket

In Supabase Dashboard:

1. **Storage** → **Buckets** → **New Bucket**
2. Name: `onboarding-documents`
3. Public: **No** (private)
4. File size limit: **25 MB** (required for CRM client documents — IEPs, diagnostic evals, etc.)
5. Allowed MIME types: PDF, PNG, JPEG, DOC/DOCX, XLS/XLSX, TXT (see `lib/crm/requirementDocuments.ts`)

### 2. Access pattern

- **Upload (onboarding PDFs):** server-side via `supabaseAdmin` — [`app/api/onboarding/pdf/upload/route.ts`](app/api/onboarding/pdf/upload/route.ts)
- **Upload (CRM client requirements):** browser → Supabase signed URL — [`upload-url` / `attach` API routes](app/api/client-services/clients/[id]/requirements/[requirementId]/)
- **Download:** authenticated API routes only (RBT/admin), never public URLs — e.g. [`app/api/rbt/documents/company/[completionId]/download/route.ts`](app/api/rbt/documents/company/[completionId]/download/route.ts)
- Paths stored on `onboarding_completions.signedPdfUrl` with `storageBucket = 'onboarding-documents'`
- CRM client requirement documents (IEP, insurance card, etc.) use prefix `crm-client-documents/` in the same bucket — uploads go **browser → Supabase** via signed URLs (bypasses Vercel 4.5 MB limit); downloads stay server-gated with audit logs.

### 3. Security

- Private bucket; no anon/public SELECT policies
- Service role for writes; reads through HRM API after session check
- Run [`prisma/supabase-rls-policies-app.sql`](prisma/supabase-rls-policies-app.sql) so `signature_certificates` and related tables have app policies when RLS is enabled
