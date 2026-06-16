import { prisma } from '@/lib/prisma'
import type { ToolResult } from '@/lib/mcp/types'

const MCP_CREATED_BY = 'MCP Connector (Claude)'

export async function addCandidateNote(args: {
  rbtProfileId: string
  note: string
}): Promise<ToolResult> {
  const rbtProfileId = args.rbtProfileId?.trim()
  const note = args.note?.trim()

  if (!rbtProfileId) throw new Error('rbtProfileId is required')
  if (!note) throw new Error('note is required')

  const profile = await prisma.rBTProfile.findUnique({
    where: { id: rbtProfileId },
    select: { id: true, firstName: true, lastName: true },
  })
  if (!profile) throw new Error(`RBT profile not found: ${rbtProfileId}`)

  await prisma.rBTAuditLog.create({
    data: {
      rbtProfileId,
      auditType: 'NOTE',
      dateTime: new Date(),
      notes: note,
      createdBy: MCP_CREATED_BY,
    },
  })

  return {
    text: `Note saved to ${profile.firstName} ${profile.lastName} (${rbtProfileId}). Length: ${note.length} characters.`,
    summary: { rbtProfileId, noteLength: note.length, saved: true },
  }
}
