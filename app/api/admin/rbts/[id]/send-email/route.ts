import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { cookies } from 'next/headers'
import { validateSession } from '@/lib/auth'
import {
  sendEmail,
  generateReachOutEmail,
  generateRejectionEmail,
  EmailTemplateType,
} from '@/lib/email'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  try {
    const cookieStore = await cookies()
    const sessionToken = cookieStore.get('session')?.value

    if (!sessionToken) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const user = await validateSession(sessionToken)
    if (!user || user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { templateType } = await request.json()

    const rbtProfile = await prisma.rBTProfile.findUnique({
      where: { id },
    })

    if (!rbtProfile || !rbtProfile.email) {
      return NextResponse.json(
        { error: 'RBT profile not found or email missing' },
        { status: 404 }
      )
    }

    let emailContent

    switch (templateType) {
      case EmailTemplateType.REACH_OUT:
        emailContent = generateReachOutEmail(rbtProfile)
        break
      case EmailTemplateType.REJECTION:
        emailContent = generateRejectionEmail(rbtProfile)
        break
      default:
        return NextResponse.json(
          { error: 'Invalid template type' },
          { status: 400 }
        )
    }

    console.log(`📧 Attempting to send ${templateType} email to ${rbtProfile.email}...`)
    
    const emailSent = await sendEmail({
      to: rbtProfile.email,
      subject: emailContent.subject,
      html: emailContent.html,
      templateType: templateType as EmailTemplateType,
      rbtProfileId: rbtProfile.id,
    })

    if (!emailSent) {
      console.error(`❌ Email sending failed for ${rbtProfile.email}`)
      return NextResponse.json({ 
        success: false,
        error: 'Email failed to send. Check server logs for details.',
        message: process.env.RESEND_API_KEY 
          ? 'Email sending failed - check Resend API key and configuration' 
          : 'RESEND_API_KEY not configured - email logged in dev mode only (check console)'
      }, { status: 500 })
    }

    console.log(`✅ Email sent successfully to ${rbtProfile.email}`)

    return NextResponse.json({ 
      success: true,
      message: process.env.RESEND_API_KEY 
        ? 'Email sent successfully via Resend' 
        : 'Email logged (dev mode - check console). Add RESEND_API_KEY to send real emails.'
    })
  } catch (error: any) {
    console.error('Error sending email:', error)
    return NextResponse.json(
      { 
        error: 'Failed to send email',
        details: process.env.NODE_ENV === 'development' ? error?.message : undefined
      },
      { status: 500 }
    )
  }
}

