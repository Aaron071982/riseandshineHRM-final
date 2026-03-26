import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAdminSession } from '@/lib/auth'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const auth = await requireAdminSession()
    if (auth.response) return auth.response

    const emailLogs = await prisma.interviewEmailLog.findMany({
      where: { rbtProfileId: id },
      orderBy: { sentAt: 'desc' },
      select: {
        id: true,
        templateType: true,
        sentAt: true,
        toEmail: true,
        subject: true,
      },
    })

    return NextResponse.json({ emailLogs })
  } catch (error) {
    console.error('Error fetching email logs:', error)
    return NextResponse.json(
      { error: 'Failed to fetch email logs' },
      { status: 500 }
    )
  }
}
