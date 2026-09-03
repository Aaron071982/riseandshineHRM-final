# MCP Connector Setup

This guide explains how to connect Claude as a custom MCP connector to your Rise & Shine HRM app.

> **Claude custom connectors use OAuth 2.0** — see [MCP_OAUTH_SETUP.md](./MCP_OAUTH_SETUP.md) for the recommended setup (no static token in Claude).

## 1. Generate the API key (optional dev/curl fallback)

Run locally:

```bash
openssl rand -hex 32
```

Copy the output — this is your `MCP_API_KEY`.

## 2. Configure environment variables

### Local development

Add to `.env.local`:

```
MCP_API_KEY=<your-generated-key>
```

### Vercel production

1. Open your Vercel project → **Settings** → **Environment Variables**
2. Add `MCP_API_KEY` with the generated value
3. Apply to Production (and Preview if desired)
4. Redeploy the app

## 3. Run the database migration

Execute in Supabase SQL editor:

```sql
-- prisma/scripts/add-mcp-activity-type.sql
ALTER TYPE "ActivityType" ADD VALUE IF NOT EXISTS 'MCP_TOOL_CALL';
```

Then regenerate Prisma client:

```bash
npx prisma generate
```

## 4. MCP server URL

```
https://www.riseandshinehrm.com/api/mcp
```

Replace with your domain in non-production environments (e.g. `http://localhost:3000/api/mcp`).

## 5. Add Claude custom connector

1. Open Claude → **Settings** → **Connectors** (or **Integrations**)
2. Choose **Add custom connector** / **Remote MCP server**
3. Set the server URL to `https://[your-domain]/api/mcp`
4. Configure authentication:
   - **Production:** OAuth (see [MCP_OAUTH_SETUP.md](./MCP_OAUTH_SETUP.md))
   - **Dev fallback:** Bearer token with your `MCP_API_KEY`
5. Save and enable the connector in a conversation

Claude will ask for confirmation before calling write tools.

## 6. OAuth scopes

| Scope | Access |
|-------|--------|
| `mcp:read` | HR read tools (onboarding, pipeline, idle hires, lookup) |
| `mcp:write` | HR write: `add_candidate_note` |
| `mcp:phi` | Client Services CRM tools (clients, staffing, assessments, ops). **Not** document contents. |
| `mcp:phi:documents` | `read_document` contents. OAuth + named allowlist. Static API key blocked. |

The consent screen requests all four scopes. Static `MCP_API_KEY` auth can use HR read/write tools only — **not** PHI/CRM or document tools.

## 7. Available tools

### HR (requires `mcp:read` / `mcp:write`)

| Tool | Type | Description |
|------|------|-------------|
| `get_onboarding_status` | Read | Hired RBTs with onboarding progress, incomplete steps, and post-hire stage. |
| `get_pipeline_stats` | Read | HR pipeline + client pipeline counts, interviews, onboarding completion. |
| `find_idle_hires` | Read | Hired RBTs with zero client assignments who need matching. |
| `lookup_bt` | Read | Search by name or email; status, contact, location, onboarding %, training, caseload. |
| `add_candidate_note` | **Write** | Adds a permanent note to the RBT profile timeline. Requires user confirmation. |

### Client Services CRM (requires `mcp:phi`)

| Tool | Type | Description |
|------|------|-------------|
| `lookup_client` | Read | Search clients by name, code, or ID. |
| `list_clients` | Read | Paginated client list with stage/status filters. |
| `get_client_summary` | Read | Full client snapshot: stage, auth, team, docs, BT assignments. |
| `get_client_schedule` | Read | Active weekly schedule entries for a client. |
| `get_clients_needing_staffing` | Read | Clients flagged for replacement or understaffed. |
| `get_staff_caseload` | Read | Active assignments for an RBT/BT. |
| `find_nearest_therapists` | Read | Proximity-ranked therapists for a client (map data). |
| `flag_staffing` | **Write** | Flag a schedule assignment for staffing replacement. |
| `add_client_note` | **Write** | Add a note to a client record. Requires user confirmation. |
| `get_assessment_status` | Read | Clinical + treatment assessment status for a client. |
| `list_assessments` | Read | Paginated treatment assessments with filters. |
| `get_missing_documents` | Read | Clients with outstanding document requirements. |
| `get_authorizations_expiring` | Read | Authorizations expiring within N days. |
| `get_reassessments_due` | Read | Clients due for reassessment. |
| `get_email_activity` | Read | Recent outbound email metadata (no body content). |
| `get_weekly_summary_stats` | Read | Manager dashboard KPIs for the current week. |
| `list_client_documents` | Read | On-file document inventory (ids, types, `readableVia`). No contents. |

### Document contents (requires `mcp:phi:documents` + allowlist)

| Tool | Type | Description |
|------|------|-------------|
| `read_document` | Read | One document by id. Default `mode=text` for clinical/admin PDFs. Photo IDs / insurance / Medicaid cards are **link-only**. |

Also run `prisma/scripts/add-mcp-document-access.sql`. Re-authorize OAuth so the token includes `mcp:phi:documents`. Manage the allowlist at `/admin/mcp-connections`. Review `/admin/mcp-document-access`.

## 8. Audit log

All MCP tool calls (reads and writes) are logged to `activity_logs` with type `MCP_TOOL_CALL`. PHI access is flagged with resource type `MCP_PHI`.

View them in the admin UI:

```
/admin/mcp-activity
```

Filter by tool name, date range, and PHI-only events. Argument and result summaries are stored without full PHI (e.g. note length instead of note text).

Manage OAuth tokens at `/admin/mcp-connections`.

## 9. Security boundaries

**Excluded** from MCP (by design):

- Sending emails or SMS
- Deleting records
- Modifying documents or signatures
- Changing pay rates or financial data
- Modifying access controls or permissions
- Bulk destructive operations

## 10. Quick test (curl)

```bash
export MCP_API_KEY="your-key-here"

curl -s -X POST "http://localhost:3000/api/mcp" \
  -H "Authorization: Bearer $MCP_API_KEY" \
  -H "Content-Type: application/json" \
  -H "Accept: application/json, text/event-stream" \
  -d '{"jsonrpc":"2.0","method":"initialize","params":{"protocolVersion":"2024-11-05","capabilities":{},"clientInfo":{"name":"test","version":"1.0"}},"id":1}'
```

After initialize, send `tools/list` and `tools/call` requests per the MCP protocol.
