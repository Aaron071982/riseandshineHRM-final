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
