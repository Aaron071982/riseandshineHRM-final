import { prisma } from './prisma'
import { Resend } from 'resend'

const OTP_EXPIRY_MINUTES = 5

export async function sendOTPEmail(email: string, code: string): Promise<boolean> {
  const subject = 'Your Rise and Shine HRM Verification Code'
  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background-color: #E4893D; color: white; padding: 20px; text-align: center; }
        .content { padding: 20px; background-color: #f9f9f9; }
        .code { font-size: 32px; font-weight: bold; text-align: center; letter-spacing: 8px; padding: 20px; background-color: white; border: 2px dashed #E4893D; margin: 20px 0; }
        .footer { padding: 20px; text-align: center; font-size: 12px; color: #666; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>Rise and Shine</h1>
        </div>
        <div class="content">
          <p>Hello,</p>
          <p>Your verification code for Rise and Shine HRM is:</p>
          <div class="code">${code}</div>
          <p>This code will expire in 5 minutes.</p>
          <p>If you didn't request this code, please ignore this email.</p>
          <p>Best regards,<br>The Rise and Shine Team</p>
        </div>
        <div class="footer">
          <p>Rise and Shine HRM</p>
        </div>
      </div>
    </body>
    </html>
  `

  // In development or if Resend is not configured, just log
  const resendApiKey = process.env.RESEND_API_KEY
  if (!resendApiKey) {
    console.log(`[DEV MODE] OTP for ${email}: ${code}`)
    return true
  }

  try {
    // For OTP emails, we'll use a simple email send (not logging to interview_email_logs)
    // You could create a separate table for OTP emails if needed
    const resend = new Resend(resendApiKey)
    const emailFrom = process.env.EMAIL_FROM || 'noreply@riseandshinehrm.com'

    await resend.emails.send({
      from: emailFrom,
      to: email,
      subject: subject,
      html: html,
    })
    return true
  } catch (error) {
    console.error('Error sending OTP email:', error)
    return false
  }
}

export async function storeOTPEmail(email: string, code: string): Promise<void> {
  const cleanEmail = email?.trim().toLowerCase() ?? ''
  const cleanCode = code?.trim().replace(/\s/g, '') || code
  try {
    const expiresAt = new Date(Date.now() + OTP_EXPIRY_MINUTES * 60 * 1000)
    await prisma.otpCode.deleteMany({
      where: {
        email: cleanEmail,
        OR: [
          { used: true },
          { expiresAt: { lt: new Date() } },
        ],
      },
    })
    await prisma.otpCode.create({
      data: {
        email: cleanEmail,
        code: cleanCode,
        expiresAt,
      },
    })
  } catch (error: unknown) {
    console.error('[auth][email-otp] storeOTPEmail error', (error as Error)?.message, error)
    throw error
  }
}

export async function verifyOTPEmail(email: string, code: string): Promise<boolean> {
  const cleanEmail = email?.trim().toLowerCase() ?? ''
  const cleanCode = code?.trim().replace(/\s/g, '') ?? '' // digits only, no spaces
  try {
    const otp = await prisma.otpCode.findFirst({
      where: {
        email: cleanEmail,
        code: cleanCode,
        used: false,
      },
    })

    if (!otp) {
      console.log('[auth][email-otp] No OTP found', {
        email: cleanEmail ? `${cleanEmail.slice(0, 3)}***` : '',
        codeLength: cleanCode.length,
        codePreview: cleanCode ? `${cleanCode.slice(0, 2)}****` : '',
      })
      return false
    }

    const now = new Date()
    if (otp.expiresAt < now) {
      console.log('[auth][email-otp] OTP expired', {
        expiresAt: otp.expiresAt.toISOString(),
        now: now.toISOString(),
      })
      return false
    }

    await prisma.otpCode.update({
      where: { id: otp.id },
      data: { used: true },
    })
    return true
  } catch (error: unknown) {
    console.error('[auth][email-otp] verifyOTPEmail error', (error as Error)?.message, error)
    return false
  }
}

