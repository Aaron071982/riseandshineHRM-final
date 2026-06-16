-- Add MCP_TOOL_CALL to ActivityType enum for MCP connector audit logging.
-- Run manually in Supabase SQL editor if not using prisma migrate.

ALTER TYPE "ActivityType" ADD VALUE IF NOT EXISTS 'MCP_TOOL_CALL';
