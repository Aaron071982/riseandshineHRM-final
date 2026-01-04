import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { cookies } from 'next/headers'
import { validateSession } from '@/lib/auth'
import { PDFDocument, rgb, StandardFonts } from 'pdf-lib'

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

    // Only allow for acknowledgments
    if (completion.document.type !== 'ACKNOWLEDGMENT') {
      return NextResponse.json(
        { error: 'This endpoint is only for acknowledgment receipts' },
        { status: 400 }
      )
    }

    if (!completion.acknowledgmentJson) {
      return NextResponse.json(
        { error: 'Acknowledgment data not found' },
        { status: 404 }
      )
    }

    const ackData = completion.acknowledgmentJson as any

    // Create a new PDF document
    const pdfDoc = await PDFDocument.create()
    const page = pdfDoc.addPage([612, 792]) // US Letter size
    const font = await pdfDoc.embedFont(StandardFonts.Helvetica)
    const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold)

    let yPosition = 750

    // Title
    page.drawText('Acknowledgment Receipt', {
      x: 50,
      y: yPosition,
      size: 24,
      font: boldFont,
      color: rgb(0, 0, 0),
    })
    yPosition -= 40

    // Document Information
    page.drawText(`Document: ${completion.document.title}`, {
      x: 50,
      y: yPosition,
      size: 14,
      font: boldFont,
    })
    yPosition -= 30

    page.drawText(`Employee: ${completion.rbtProfile.firstName} ${completion.rbtProfile.lastName}`, {
      x: 50,
      y: yPosition,
      size: 12,
      font: font,
    })
    yPosition -= 25

    if (completion.completedAt) {
      const completedDate = new Date(completion.completedAt).toLocaleString('en-US', {
        timeZone: 'America/New_York',
        dateStyle: 'long',
        timeStyle: 'short',
      })
      page.drawText(`Completed: ${completedDate}`, {
        x: 50,
        y: yPosition,
        size: 12,
        font: font,
      })
      yPosition -= 30
    }

    // Separator
    yPosition -= 20
    page.drawLine({
      start: { x: 50, y: yPosition },
      end: { x: 562, y: yPosition },
      thickness: 1,
      color: rgb(0.8, 0.8, 0.8),
    })
    yPosition -= 30

    // Acknowledgment Details
    page.drawText('Acknowledgment Details', {
      x: 50,
      y: yPosition,
      size: 16,
      font: boldFont,
    })
    yPosition -= 30

    if (ackData.typedName) {
      page.drawText(`Signed By: ${ackData.typedName}`, {
        x: 50,
        y: yPosition,
        size: 12,
        font: font,
      })
      yPosition -= 25
    }

    if (ackData.readConfirmed) {
      page.drawText('✓ I have read and reviewed the entire document', {
        x: 50,
        y: yPosition,
        size: 12,
        font: font,
        color: rgb(0, 0.6, 0),
      })
      yPosition -= 25
    }

    if (ackData.agreeConfirmed) {
      page.drawText('✓ I agree to the terms and conditions', {
        x: 50,
        y: yPosition,
        size: 12,
        font: font,
        color: rgb(0, 0.6, 0),
      })
      yPosition -= 30
    }

    // Signature Image (if available)
    if (ackData.signatureData && typeof ackData.signatureData === 'string') {
      try {
        // Check if it's a base64 image
        if (ackData.signatureData.startsWith('data:image')) {
          const parts = ackData.signatureData.split(',')
          const base64Data = parts.length > 1 ? parts[1] : ackData.signatureData
          
          if (base64Data && base64Data.length > 0) {
            try {
              const imageBytes = Uint8Array.from(atob(base64Data), (c) => c.charCodeAt(0))
              
              // Determine image type
              let image
              if (ackData.signatureData.includes('image/png')) {
                image = await pdfDoc.embedPng(imageBytes)
              } else if (ackData.signatureData.includes('image/jpeg') || ackData.signatureData.includes('image/jpg')) {
                image = await pdfDoc.embedJpg(imageBytes)
              } else {
                // Default to PNG if type not specified
                image = await pdfDoc.embedPng(imageBytes)
              }

              yPosition -= 20
              page.drawText('Signature:', {
                x: 50,
                y: yPosition,
                size: 12,
                font: boldFont,
              })
              yPosition -= 80

              // Embed signature image (max width 200px, maintain aspect ratio)
              const maxWidth = 200
              const maxHeight = 80
              const dims = image.scale(maxWidth / image.width)
              const height = dims.height > maxHeight ? maxHeight : dims.height
              const width = dims.width * (height / dims.height)

              page.drawImage(image, {
                x: 50,
                y: yPosition - height,
                width: width,
                height: height,
              })
              yPosition -= height + 20
            } catch (imageError) {
              console.error('Error embedding signature image:', imageError)
              // Continue without signature image
            }
          }
        }
      } catch (error) {
        console.error('Error processing signature data:', error)
        // Continue without signature image
      }
    }

    // Metadata
    yPosition -= 40
    page.drawLine({
      start: { x: 50, y: yPosition },
      end: { x: 562, y: yPosition },
      thickness: 1,
      color: rgb(0.8, 0.8, 0.8),
    })
    yPosition -= 30

    page.drawText('Metadata', {
      x: 50,
      y: yPosition,
      size: 14,
      font: boldFont,
    })
    yPosition -= 25

    if (ackData.timestamp) {
      page.drawText(`Timestamp: ${new Date(ackData.timestamp).toLocaleString('en-US', { timeZone: 'America/New_York' })}`, {
        x: 50,
        y: yPosition,
        size: 10,
        font: font,
        color: rgb(0.5, 0.5, 0.5),
      })
      yPosition -= 20
    }

    if (ackData.ip) {
      page.drawText(`IP Address: ${ackData.ip}`, {
        x: 50,
        y: yPosition,
        size: 10,
        font: font,
        color: rgb(0.5, 0.5, 0.5),
      })
    }

    // Generate PDF bytes
    const pdfBytes = await pdfDoc.save()

    // Generate filename
    const sanitizedTitle = completion.document.title.replace(/[^a-z0-9]/gi, '_').toLowerCase()
    const filename = `${sanitizedTitle}_acknowledgment_${completion.rbtProfile.firstName}_${completion.rbtProfile.lastName}.pdf`

    // Convert Uint8Array to Buffer for NextResponse
    const pdfBuffer = Buffer.from(pdfBytes)

    // Return PDF file
    return new NextResponse(pdfBuffer, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Content-Length': pdfBuffer.length.toString(),
      },
    })
  } catch (error: any) {
    console.error('Error generating acknowledgment PDF:', error)
    return NextResponse.json(
      { error: 'Failed to generate acknowledgment PDF' },
      { status: 500 }
    )
  }
}

