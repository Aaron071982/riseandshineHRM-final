import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { cookies } from 'next/headers'
import { validateSession } from '@/lib/auth'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ rbtProfileId: string; completionId: string }> }
) {
  try {
    const { rbtProfileId, completionId } = await params
    const cookieStore = await cookies()
    const sessionToken = cookieStore.get('session')?.value

    if (!sessionToken) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const user = await validateSession(sessionToken)
    if (!user || user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // Get the completion record
    const completion = await prisma.onboardingCompletion.findUnique({
      where: { id: completionId },
      include: {
        document: true,
        rbtProfile: true,
      },
    })

    if (!completion) {
      return NextResponse.json({ error: 'Completion not found' }, { status: 404 })
    }

    // Verify it belongs to the specified RBT
    if (completion.rbtProfileId !== rbtProfileId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // Only allow download for fillable PDFs
    if (completion.document.type !== 'FILLABLE_PDF') {
      return NextResponse.json(
        { error: 'This endpoint is only for fillable PDF downloads' },
        { status: 400 }
      )
    }

    if (!completion.signedPdfData) {
      return NextResponse.json(
        { error: 'Completed PDF data not found' },
        { status: 404 }
      )
    }

    // Convert base64 to buffer
    const pdfBuffer = Buffer.from(completion.signedPdfData, 'base64')

    // Generate filename
    const sanitizedTitle = completion.document.title.replace(/[^a-z0-9]/gi, '_').toLowerCase()
    const filename = `${sanitizedTitle}_${completion.rbtProfile.firstName}_${completion.rbtProfile.lastName}.pdf`

    // Return PDF file
    return new NextResponse(pdfBuffer, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Content-Length': pdfBuffer.length.toString(),
      },
    })
  } catch (error: any) {
    console.error('Error downloading completion PDF:', error)
    return NextResponse.json(
      { error: 'Failed to download PDF' },
      { status: 500 }
    )
  }
}

