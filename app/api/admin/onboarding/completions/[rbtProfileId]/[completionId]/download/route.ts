import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { cookies } from 'next/headers'
import { validateSession } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabase'

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
      select: {
        id: true,
        rbtProfileId: true,
        documentId: true,
        status: true,
        completedAt: true,
        signedPdfUrl: true,
        signedPdfData: true,
        storageBucket: true,
        storagePath: true,
        fieldValues: true,
        document: {
          select: {
            id: true,
            title: true,
            type: true,
          },
        },
        rbtProfile: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
          },
        },
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

    // Generate filename
    const sanitizedTitle = completion.document.title.replace(/[^a-z0-9]/gi, '_').toLowerCase()
    const filename = `${sanitizedTitle}_${completion.rbtProfile.firstName}_${completion.rbtProfile.lastName}.pdf`

    // Check if PDF is stored in Supabase Storage
    if (completion.storagePath && completion.storageBucket && supabaseAdmin) {
      try {
        // Download file from Supabase Storage using storagePath
        const { data: fileData, error: downloadError } = await supabaseAdmin.storage
          .from(completion.storageBucket)
          .download(completion.storagePath)

        if (downloadError) {
          console.error('Supabase Storage download error:', downloadError)
          // Fall through to base64 fallback
        } else if (fileData) {
          // Convert Blob to ArrayBuffer then to Buffer
          const arrayBuffer = await fileData.arrayBuffer()
          const pdfBuffer = Buffer.from(arrayBuffer)

          // Return PDF file
          return new NextResponse(pdfBuffer, {
            headers: {
              'Content-Type': 'application/pdf',
              'Content-Disposition': `attachment; filename="${filename}"`,
              'Content-Length': pdfBuffer.length.toString(),
            },
          })
        }
      } catch (storageError) {
        console.error('Error downloading from Supabase Storage:', storageError)
        // Fall through to base64 fallback
      }
    }

    // Fallback to base64 stored data (legacy records)
    if (completion.signedPdfData) {
      // Convert base64 to buffer
      const pdfBuffer = Buffer.from(completion.signedPdfData, 'base64')

      // Return PDF file
      return new NextResponse(pdfBuffer, {
        headers: {
          'Content-Type': 'application/pdf',
          'Content-Disposition': `attachment; filename="${filename}"`,
          'Content-Length': pdfBuffer.length.toString(),
        },
      })
    }

    // No PDF data found
    return NextResponse.json(
      { error: 'Completed PDF data not found' },
      { status: 404 }
    )
  } catch (error: any) {
    console.error('Error downloading completion PDF:', error)
    return NextResponse.json(
      { error: 'Failed to download PDF' },
      { status: 500 }
    )
  }
}

