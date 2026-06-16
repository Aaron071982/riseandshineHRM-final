# MCP Connector Setup (v1)

This guide explains how to connect Claude as a custom MCP connector to your Rise & Shine HRM app.

## 1. Generate the API key

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
https://riseandshinehrm.com/api/mcp
```

Replace with your domain in non-production environments (e.g. `http://localhost:3000/api/mcp`).

## 5. Add Claude custom connector

1. Open Claude → **Settings** → **Connectors** (or **Integrations**)
2. Choose **Add custom connector** / **Remote MCP server**
3. Set the server URL to `https://[your-domain]/api/mcp`
4. Configure authentication:
   - Type: **Bearer token**
   - Token: your `MCP_API_KEY` value
5. Save and enable the connector in a conversation

Claude will ask for confirmation before calling write tools. The only write tool in v1 is `add_candidate_note`.

## 6. Available tools (v1)

| Tool | Type | Description |
|------|------|-------------|
| `get_onboarding_status` | Read | Hired RBTs with onboarding progress, incomplete steps, and post-hire stage. Optional filters: `stuckOnly`, `minDaysStuck`. |
| `get_pipeline_stats` | Read | Live pipeline metrics: counts by status, hired, actively working, idle hires, Artemis pending, onboarding completion rate, upcoming interviews. |
| `find_idle_hires` | Read | Hired RBTs with zero client assignments who need matching. Optional: `includeNotTrained`. |
| `lookup_bt` | Read | Search by name or email; returns status, contact, location, onboarding %, training, client count. |
| `add_candidate_note` | **Write** | Adds a permanent `NOTE` to the profile timeline. Only use after explicit user confirmation. |

## 7. Audit log

All MCP tool calls (reads and writes) are logged to `activity_logs` with type `MCP_TOOL_CALL`.

View them in the admin UI:

```
/admin/mcp-activity
```

Filter by date range and tool name. Argument and result summaries are stored without full PHI (e.g. note length instead of note text).

## 8. v1 scope limitations

High-risk operations are **intentionally excluded** from v1. No tools exist for:

- Sending emails or SMS
- Deleting records
- Modifying documents or signatures
- Changing pay rates or financial data
- Modifying access controls or permissions
- Bulk operations

Future tools will be added individually after explicit review.

## 9. Quick test (curl)

```bash
export MCP_API_KEY="your-key-here"

curl -s -X POST "http://localhost:3000/api/mcp" \
  -H "Authorization: Bearer $MCP_API_KEY" \
  -H "Content-Type: application/json" \
  -H "Accept: application/json, text/event-stream" \
  -d '{"jsonrpc":"2.0","method":"initialize","params":{"protocolVersion":"2024-11-05","capabilities":{},"clientInfo":{"name":"test","version":"1.0"}},"id":1}'
```

After initialize, send `tools/list` and `tools/call` requests per the MCP protocol.
