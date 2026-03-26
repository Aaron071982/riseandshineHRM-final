import { Resend } from 'resend'
import { prisma } from '../prisma'

const resendApiKey = process.env.RESEND_API_KEY
const emailFrom = process.env.EMAIL_FROM || 'noreply@riseandshinehrm.com'

let resend: Resend | null = null

if (resendApiKey) {
  resend = new Resend(resendApiKey)
}

export enum EmailTemplateType {
  REACH_OUT = 'REACH_OUT',
  APPLICATION_REVIEWED = 'APPLICATION_REVIEWED',
  INTERVIEW_INVITE = 'INTERVIEW_INVITE',
  OFFER = 'OFFER',
  REJECTION = 'REJECTION',
  MISSING_ONBOARDING = 'MISSING_ONBOARDING',
}

function getFromEmail(templateType: EmailTemplateType, customFrom?: string): string {
  if (customFrom) return customFrom
  return emailFrom
}

export interface EmailOptions {
  to: string
  subject: string
  html: string
  templateType: EmailTemplateType
  rbtProfileId: string
  fromEmail?: string
}

/**
 * Send an email without logging to interviewEmailLog (e.g. for non-RBT team members).
 */
export async function sendGenericEmail(to: string, subject: string, html: string): Promise<boolean> {
  if (!resend) {
    console.log(`⚠️ [DEV MODE] Resend not configured. Email would be sent to ${to}:`, subject)
    return true
  }
  const plainText = html
    .replace(/<style[^>]*>.*?<\/style>/gis, '')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .trim()
  const fromAddress = emailFrom.includes('@') ? `"Rise and Shine" <${emailFrom}>` : emailFrom
  try {
    const result = await resend.emails.send({
      from: fromAddress,
      to,
      subject,
      html,
      text: plainText,
      reply_to: 'info@riseandshine.nyc',
    })
    if (result.error) {
      console.error('sendGenericEmail failed:', result.error)
      return false
    }
    console.log(`✅ Generic email sent to ${to}`)
    return true
  } catch (e) {
    console.error('sendGenericEmail error:', e)
    return false
  }
}

export async function sendEmail(options: EmailOptions): Promise<boolean> {
  try {
    await prisma.interviewEmailLog.create({
      data: {
        rbtProfileId: options.rbtProfileId,
        templateType: options.templateType,
        toEmail: options.to,
        subject: options.subject,
        body: options.html,
        status: 'sent',
      },
    })
  } catch (error) {
    console.error('Error logging email:', error)
  }

  if (!resend) {
    console.log(`⚠️ [DEV MODE] Resend not configured. Email would be sent to ${options.to}:`)
    console.log(`Subject: ${options.subject}`)
    console.log(`RESEND_API_KEY is: ${process.env.RESEND_API_KEY ? 'SET' : 'NOT SET'}`)
    console.log(`Email logged to database but NOT sent. Add RESEND_API_KEY to .env to send real emails.`)
    return true
  }

  console.log(`📧 Attempting to send email to ${options.to} via Resend...`)

  try {
    const plainText = options.html
      .replace(/<style[^>]*>.*?<\/style>/gis, '')
      .replace(/<[^>]+>/g, '')
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .trim()

    const fromEmail = getFromEmail(options.templateType, options.fromEmail)
    const messageId = `<${Date.now()}-${Math.random().toString(36).substring(7)}@riseandshine.nyc>`
    const fromAddress = fromEmail.includes('@') ? `"Rise and Shine" <${fromEmail}>` : fromEmail

    const result = await resend.emails.send({
      from: fromAddress,
      to: options.to,
      subject: options.subject,
      html: options.html,
      text: plainText,
      reply_to: 'info@riseandshine.nyc',
      headers: {
        'Message-ID': messageId,
        'X-Entity-Ref-ID': options.rbtProfileId,
        'X-Mailer': 'Rise and Shine HRM',
        'Precedence': 'bulk',
        'List-Unsubscribe': '<mailto:info@riseandshine.nyc?subject=unsubscribe>',
        'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
        'X-Priority': '1',
      },
    })

    console.log(`✅ Email sent successfully to ${options.to}:`, result)

    try {
      await prisma.interviewEmailLog.updateMany({
        where: {
          rbtProfileId: options.rbtProfileId,
          toEmail: options.to,
          subject: options.subject,
        },
        data: {
          status: result.error ? 'failed' : 'delivered',
        },
      })
    } catch (updateError) {
      console.error('Error updating email log status:', updateError)
    }

    if (result.error) {
      console.error('❌ Resend API returned error:', JSON.stringify(result.error, null, 2))
      const error = result.error as { statusCode?: number; message?: string }
      if (error.statusCode === 403) {
        if (error.message?.includes('only send testing emails to your own email address')) {
          console.error('⚠️ RESEND LIMITATION: You are using the test domain (onboarding@resend.dev) which only allows sending to your own verified email address.')
        } else {
          console.error(`⚠️ Resend API 403 Error: ${error.message}`)
        }
      } else if (error.statusCode === 422) {
        console.error(`⚠️ Resend API 422 Error (Validation): ${error.message}`)
      } else {
        console.error(`⚠️ Resend API Error (${error.statusCode || 'unknown'}): ${error.message || 'Unknown error'}`)
      }
      try {
        await prisma.interviewEmailLog.updateMany({
          where: {
            rbtProfileId: options.rbtProfileId,
            toEmail: options.to,
            subject: options.subject,
          },
          data: {
            status: `failed: ${error.message || 'Resend API error'}`,
          },
        })
      } catch (updateError) {
        console.error('Error updating email log with error status:', updateError)
      }
      return false
    }

    return true
  } catch (error: unknown) {
    const err = error as { message?: string }
    console.error('❌ Error sending email via Resend:', error)
    try {
      await prisma.interviewEmailLog.updateMany({
        where: {
          rbtProfileId: options.rbtProfileId,
          toEmail: options.to,
          subject: options.subject,
        },
        data: {
          status: `failed: ${err?.message || 'unknown error'}`,
        },
      })
    } catch (updateError) {
      console.error('Error updating email log status:', updateError)
    }
    return false
  }
}
