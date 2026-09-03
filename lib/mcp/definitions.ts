/** MCP tool JSON-schema definitions (v1 HR + v2 CRM). */
export const MCP_TOOL_DEFINITIONS = [
  {
    name: 'get_onboarding_status',
    description:
      'Returns hired RBTs and their onboarding progress, including who is stuck and which documents or tasks they are missing.',
    inputSchema: {
      type: 'object',
      properties: {
        stuckOnly: { type: 'boolean', description: 'Only RBTs stuck 7+ days.' },
        minDaysStuck: { type: 'number', description: 'Minimum days in current onboarding state.' },
      },
    },
  },
  {
    name: 'get_pipeline_stats',
    description:
      'Live HR pipeline stats plus client CRM pipeline counts by stage.',
    inputSchema: { type: 'object', properties: {} },
  },
  {
    name: 'find_idle_hires',
    description: 'Hired RBTs with no active client assignments who need matching.',
    inputSchema: {
      type: 'object',
      properties: {
        includeNotTrained: { type: 'boolean', description: 'Include RBTs without Artemis training.' },
      },
    },
  },
  {
    name: 'lookup_bt',
    description: 'Look up a BT/candidate by name or email.',
    inputSchema: {
      type: 'object',
      properties: { query: { type: 'string', description: 'Name or email.' } },
      required: ['query'],
    },
  },
  {
    name: 'add_candidate_note',
    description: 'Add an internal note to an RBT profile (requires user confirmation).',
    inputSchema: {
      type: 'object',
      properties: {
        rbtProfileId: { type: 'string' },
        note: { type: 'string' },
      },
      required: ['rbtProfileId', 'note'],
    },
  },
  {
    name: 'lookup_client',
    description: 'Look up a client by name, code, or parent email. Returns stage, BTs, address, auth hours.',
    inputSchema: {
      type: 'object',
      properties: { query: { type: 'string' } },
      required: ['query'],
    },
  },
  {
    name: 'list_clients',
    description: 'List LIVE clients with optional filters. Paginated.',
    inputSchema: {
      type: 'object',
      properties: {
        stage: { type: 'string' },
        state: { type: 'string' },
        needs_staffing: { type: 'boolean' },
        missing_docs: { type: 'boolean' },
        limit: { type: 'number' },
        cursor: { type: 'string' },
      },
    },
  },
  {
    name: 'get_client_summary',
    description: 'One-glance client status: stage, BTs, BCBA, address, auth hours, doc gaps.',
    inputSchema: {
      type: 'object',
      properties: { client: { type: 'string', description: 'Client ID or code.' } },
      required: ['client'],
    },
  },
  {
    name: 'get_client_schedule',
    description: 'Active BT schedule entries for a client.',
    inputSchema: {
      type: 'object',
      properties: { client: { type: 'string' } },
      required: ['client'],
    },
  },
  {
    name: 'get_clients_needing_staffing',
    description: 'Canonical needs-staffing list with reasons (unstaffed, understaffed, losing staff soon).',
    inputSchema: { type: 'object', properties: {} },
  },
  {
    name: 'get_staff_caseload',
    description: 'RBT caseload: assigned clients, scheduled hours, remaining capacity.',
    inputSchema: {
      type: 'object',
      properties: { staff: { type: 'string', description: 'RBT profile ID or name.' } },
      required: ['staff'],
    },
  },
  {
    name: 'find_nearest_therapists',
    description: 'Proximity-ranked hired therapists for a client (Mapbox drive time).',
    inputSchema: {
      type: 'object',
      properties: {
        client: { type: 'string' },
        only_available: { type: 'boolean' },
        include_capacity: { type: 'boolean' },
      },
      required: ['client'],
    },
  },
  {
    name: 'flag_staffing',
    description:
      'Flag staffing need: assignment-level (client+rbt+reason+expected_end_date) or staff departure (rbt+last_day).',
    inputSchema: {
      type: 'object',
      properties: {
        client: { type: 'string' },
        rbtProfileId: { type: 'string' },
        staff: { type: 'string' },
        reason: { type: 'string' },
        expected_end_date: { type: 'string', description: 'YYYY-MM-DD' },
        last_day: { type: 'string', description: 'YYYY-MM-DD for staff departure' },
        departure_note: { type: 'string' },
      },
    },
  },
  {
    name: 'add_client_note',
    description: 'Add an internal note to a client record (requires user confirmation).',
    inputSchema: {
      type: 'object',
      properties: {
        client: { type: 'string' },
        note: { type: 'string' },
      },
      required: ['client', 'note'],
    },
  },
  {
    name: 'get_assessment_status',
    description: 'Clinical + treatment assessment status for a client.',
    inputSchema: {
      type: 'object',
      properties: { client: { type: 'string' } },
      required: ['client'],
    },
  },
  {
    name: 'list_assessments',
    description: 'List treatment assessments with optional status/date filters.',
    inputSchema: {
      type: 'object',
      properties: {
        status: { type: 'string' },
        started_after: { type: 'string' },
        limit: { type: 'number' },
        cursor: { type: 'string' },
      },
    },
  },
  {
    name: 'get_missing_documents',
    description: 'Outstanding required document requirements (status only, not file contents).',
    inputSchema: {
      type: 'object',
      properties: { client: { type: 'string', description: 'Optional client ID/code filter.' } },
    },
  },
  {
    name: 'get_authorizations_expiring',
    description: 'Authorizations in attention window (default 30 days).',
    inputSchema: {
      type: 'object',
      properties: { days: { type: 'number', description: 'Max days until expiry (default 30).' } },
    },
  },
  {
    name: 'get_reassessments_due',
    description: 'Treatment authorizations due for reassessment.',
    inputSchema: { type: 'object', properties: {} },
  },
  {
    name: 'get_email_activity',
    description: 'Outbound email activity metadata (Operations email log).',
    inputSchema: {
      type: 'object',
      properties: {
        sender: { type: 'string' },
        template: { type: 'string' },
        client: { type: 'string' },
        date_range: { type: 'string', enum: ['week_to_date', 'last_full_week'] },
        from: { type: 'string' },
        to: { type: 'string' },
        limit: { type: 'number' },
        cursor: { type: 'string' },
      },
    },
  },
  {
    name: 'get_weekly_summary_stats',
    description: 'Weekly digest aggregates: email sends, pipeline KPIs, queue counts.',
    inputSchema: {
      type: 'object',
      properties: { week: { type: 'string', description: 'Optional label override.' } },
    },
  },
  {
    name: 'list_client_documents',
    description:
      'List on-file client documents (metadata only): documentId, type, uploadedAt, readableVia (text/link/blocked). Use read_document to fetch contents.',
    inputSchema: {
      type: 'object',
      properties: { client: { type: 'string', description: 'Client name, code, or id.' } },
      required: ['client'],
    },
  },
  {
    name: 'read_document',
    description:
      'Read one client document by documentId. Default mode is text for clinical/admin docs. Identity/financial docs (photo ID, insurance/Medicaid cards) are link-only — never returned as text. Requires mcp:phi:documents and the document-read allowlist. One document per call.',
    inputSchema: {
      type: 'object',
      properties: {
        documentId: { type: 'string' },
        mode: {
          type: 'string',
          enum: ['text', 'link'],
          description: 'text (default) extracts PDF/plain text; link returns a 5-minute viewing URL.',
        },
      },
      required: ['documentId'],
    },
  },
  {
    name: 'get_staff_pay',
    description:
      'Super-admin only. Actual pay for a staffer over a date range from published payroll runs (gross/net, pay dates, hours×rate breakdown) plus Artemis estimated payable. Default match_by=worked (service period); match_by=pay_date uses paycheck date. SSN/bank/ID numbers stay masked.',
    inputSchema: {
      type: 'object',
      properties: {
        staff: { type: 'string', description: 'Name, email, or RBT profile id.' },
        date_range: { type: 'string', description: 'e.g. "2026-03-13 to 2026-03-26"' },
        from: { type: 'string' },
        to: { type: 'string' },
        match_by: { type: 'string', enum: ['worked', 'pay_date'] },
      },
      required: ['staff'],
    },
  },
  {
    name: 'get_staff_worked_sessions',
    description:
      'Super-admin only. Days worked from Artemis session-reconciliation (date, hours, client). No dollar figures.',
    inputSchema: {
      type: 'object',
      properties: {
        staff: { type: 'string' },
        date_range: { type: 'string' },
        from: { type: 'string' },
        to: { type: 'string' },
      },
      required: ['staff'],
    },
  },
  {
    name: 'get_payroll_summary',
    description:
      'Super-admin only. Payroll roll-up across staff for a period: who got paid, totals, pay dates. Default match_by=worked.',
    inputSchema: {
      type: 'object',
      properties: {
        date_range: { type: 'string' },
        from: { type: 'string' },
        to: { type: 'string' },
        match_by: { type: 'string', enum: ['worked', 'pay_date'] },
      },
    },
  },
] as const
