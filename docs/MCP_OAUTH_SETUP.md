# MCP OAuth Setup (Claude Custom Connector)

Claude's MCP custom connectors use **OAuth 2.0 Authorization Code + PKCE** with Dynamic Client Registration. No static API key is required in Claude's connector settings.

## Prerequisites

1. Run the OAuth database migration in Supabase:

```sql
-- prisma/scripts/add-oauth-tables.sql
```

2. Ensure `NEXT_PUBLIC_BASE_URL` is set to `https://www.riseandshinehrm.com` in Vercel (canonical destination; non-www redirects to www).

3. Deploy the app.

## Discovery endpoints

Claude discovers OAuth configuration automatically:

| Endpoint | URL |
|----------|-----|
| Authorization server metadata | `/.well-known/oauth-authorization-server` |
| Protected resource metadata | `/.well-known/oauth-protected-resource` |
| MCP resource | `/api/mcp` |

## Connect Claude

1. Open **Claude → Settings → Connectors → Add custom connector**
2. Enter only the MCP URL (no token):

```
https://www.riseandshinehrm.com/api/mcp
```

3. Claude registers a client via `POST /api/oauth/register` and redirects you to authorize.
4. You are sent to `/api/oauth/authorize`:
   - If not logged in → `/login` → OTP → back to authorize
   - **Only ADMIN users** can approve
5. Consent screen: **Approve** or **Deny**
6. Claude exchanges the code at `/api/oauth/token` (PKCE verified) and receives a 30-day access token with scopes `mcp:read mcp:write mcp:phi mcp:phi:documents mcp:superadmin`.

## Scopes

| Scope | Purpose |
|-------|---------|
| `mcp:read` | HR pipeline and onboarding read tools |
| `mcp:write` | `add_candidate_note` |
| `mcp:phi` | Client Services CRM metadata (clients, staffing, assessments, ops). Does **not** include document contents. |
| `mcp:phi:documents` | Document contents via `read_document`. Requires the named allowlist as well. **Never granted to `MCP_API_KEY`.** |
| `mcp:superadmin` | Pay/compensation + worked sessions + payroll summary. Encompasses PHI/documents for gate checks. **OAuth + five-executive allowlist only.** |

### Super-admin (pay / compensation)

Named executives (`@riseandshineaba.com`): **irsal@**, **kazi@**, **siyam@**, **shazia@**, **fardeen@**. Also `User.mcp_super_admin` flag.

Tools (read-only):
- `get_staff_pay` — published payroll amounts + Artemis estimates; default match by worked/service period (`match_by=pay_date` optional)
- `get_staff_worked_sessions` — Artemis days worked (no dollars)
- `get_payroll_summary` — period roll-up across staff

SSN / government ID / bank / card numbers stay **masked (last-4)** even for super-admins. Photo IDs / insurance images stay link-only via the document policy.

Audit: `/admin/mcp-sensitive-access` (categories PAY / WORKED_SESSIONS / PAYROLL). Denied attempts are logged and alert admins.

### Document contents (`read_document`)

Three gates, all required:

1. OAuth scope `mcp:phi:documents`
2. Actor on the document-read allowlist: CRM **SUPER_ADMIN** or **INTAKE**, platform super-admin email, or explicit `can_read_client_documents` flag (Admin → MCP Connections)
3. Per-document-type policy:
   - **Text:** psych eval, DSM-5, treatment/assessment, IEP/IFSP, referral, Vineland/FAST, intake, demographics, VOB/eligibility, consent
   - **Link-only (never text/OCR):** parent/guardian photo ID, insurance card, Medicaid card, other government IDs
   - **Blocked:** anything unclassified

Default `read_document` mode is **text** (explicit opt-in for clinical files). Identity docs refuse text even for allowlisted users.

Inventory (metadata only) is `list_client_documents` and only needs `mcp:phi`.

Audit: every attempt — including refusals — is stored in `document_access_logs` and shown at `/admin/mcp-document-access`. Blocked events and unusual volume create in-app admin notifications.

Re-authorize the connector after this change so the token includes `mcp:phi:documents` / `mcp:superadmin` as needed. Existing tokens without those scopes cannot call the new tools.

CRM tools are blocked unless the OAuth token includes `mcp:phi`. The static `MCP_API_KEY` fallback cannot access PHI, document, or super-admin tools.

## Test the connection

Ask Claude:

> Who's stuck in onboarding?

Claude should call `get_onboarding_status` and return hired RBTs with incomplete steps.

## Manage access

### Active connections

**Admin → More → MCP Connections** (`/admin/mcp-connections`)

- Lists active OAuth tokens (client name, issued, expiry, last used)
- **Revoke** per token
- **Revoke all tokens** emergency button

### Tool activity log

**Admin → More → MCP Activity** (`/admin/mcp-activity`)

- Every MCP tool call (reads and writes) is logged

### Document access log

**Admin → More → MCP Documents** (`/admin/mcp-document-access`)

- Every `read_document` attempt (including blocked)
- Allowlist toggles live on **MCP Connections**

### Sensitive / pay access log

**Admin → More → MCP Sensitive** (`/admin/mcp-sensitive-access`)

- Super-admin pay, payroll, and worked-session reads
- Denied attempts and volume alerts

## Security notes

- **PKCE required** — authorize requests without `code_challenge` are rejected
- Authorization codes expire in **60 seconds** and are **single-use**
- Access tokens stored **SHA-256 hashed** in the database
- `redirect_uri` must be **HTTPS** on `claude.ai`, `claude.com`, or `anthropic.com` (localhost allowed in dev)
- Only **admin session holders** can approve the consent screen
- Static `MCP_API_KEY` still works as a **dev/testing fallback** for direct `curl` calls

## Direct API testing (optional fallback)

If `MCP_API_KEY` is set in your environment:

```bash
curl -s -X POST "https://www.riseandshinehrm.com/api/mcp" \
  -H "Authorization: Bearer $MCP_API_KEY" \
  -H "Content-Type: application/json" \
  -H "Accept: application/json, text/event-stream" \
  -d '{"jsonrpc":"2.0","method":"initialize","params":{"protocolVersion":"2024-11-05","capabilities":{},"clientInfo":{"name":"test","version":"1.0"}},"id":1}'
```

Production Claude connections should use OAuth only.

## Troubleshooting

| Issue | Fix |
|-------|-----|
| Redirect URI rejected | Ensure Claude's callback URL is on an allowed domain |
| "Only admins can authorize" | Log in with an admin work email |
| 401 on MCP calls | Token expired or revoked — re-authorize in Claude |
| Connector can't discover OAuth | Verify `/.well-known/oauth-authorization-server` returns JSON |
