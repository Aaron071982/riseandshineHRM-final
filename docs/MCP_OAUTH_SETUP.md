# MCP OAuth Setup (Claude Custom Connector)

Claude's MCP custom connectors use **OAuth 2.0 Authorization Code + PKCE** with Dynamic Client Registration. No static API key is required in Claude's connector settings.

## Prerequisites

1. Run the OAuth database migration in Supabase:

```sql
-- prisma/scripts/add-oauth-tables.sql
```

2. Ensure `NEXT_PUBLIC_BASE_URL` is set to your production domain (e.g. `https://riseandshinehrm.com`).

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
https://riseandshinehrm.com/api/mcp
```

3. Claude registers a client via `POST /api/oauth/register` and redirects you to authorize.
4. You are sent to `/api/oauth/authorize`:
   - If not logged in → `/login` → OTP → back to authorize
   - **Only ADMIN users** can approve
5. Consent screen: **Approve** or **Deny**
6. Claude exchanges the code at `/api/oauth/token` (PKCE verified) and receives a 30-day access token.

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
curl -s -X POST "https://riseandshinehrm.com/api/mcp" \
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
