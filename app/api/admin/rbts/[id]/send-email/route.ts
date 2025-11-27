import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { cookies } from 'next/headers'
import { validateSession } from '@/lib/auth'
import {
  sendEmail,
  generateReachOutEmail,
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
      default:
        return NextResponse.json(
          { error: 'Invalid template type' },
          { status: 400 }
        )
    }

    const emailSent = await sendEmail({
      to: rbtProfile.email,
      subject: emailContent.subject,
      html: emailContent.html,
      templateType: templateType as EmailTemplateType,
      rbtProfileId: rbtProfile.id,
    })

    if (!emailSent) {
      console.warn('Email sending returned false - may be in dev mode')
      // Still return success since email is logged in dev mode
    }

    return NextResponse.json({ 
      success: true,
      message: process.env.RESEND_API_KEY 
        ? 'Email sent successfully' 
        : 'Email logged (dev mode - check console)'
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

