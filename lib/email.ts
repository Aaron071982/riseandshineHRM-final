import { Resend } from 'resend'
import { prisma } from './prisma'
import { formatPhoneNumber } from './sms'

const resendApiKey = process.env.RESEND_API_KEY
const emailFrom = process.env.EMAIL_FROM || 'noreply@riseandshinehrm.com'

let resend: Resend | null = null

if (resendApiKey) {
  resend = new Resend(resendApiKey)
}

export enum EmailTemplateType {
  REACH_OUT = 'REACH_OUT',
  INTERVIEW_INVITE = 'INTERVIEW_INVITE',
  OFFER = 'OFFER',
  REJECTION = 'REJECTION',
}

interface EmailOptions {
  to: string
  subject: string
  html: string
  templateType: EmailTemplateType
  rbtProfileId: string
}

export async function sendEmail(options: EmailOptions): Promise<boolean> {
  // Log email in database
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

  // In development or if Resend is not configured, just log
  if (!resend) {
    console.log(`[DEV MODE] Email to ${options.to}:`)
    console.log(`Subject: ${options.subject}`)
    console.log(`Body: ${options.html}`)
    return true
  }

  try {
    await resend.emails.send({
      from: emailFrom,
      to: options.to,
      subject: options.subject,
      html: options.html,
    })
    return true
  } catch (error) {
    console.error('Error sending email:', error)
    return false
  }
}

export function generateReachOutEmail(rbtProfile: {
  firstName: string
  lastName: string
  email: string | null
}): { subject: string; html: string } {
  const subject = 'Opportunity at Rise and Shine - We\'d Love to Connect!'
  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background-color: #E4893D; color: white; padding: 20px; text-align: center; }
        .content { padding: 20px; background-color: #f9f9f9; }
        .footer { padding: 20px; text-align: center; font-size: 12px; color: #666; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>Rise and Shine</h1>
        </div>
        <div class="content">
          <p>Hello ${rbtProfile.firstName},</p>
          <p>We hope this message finds you well. We came across your profile and believe you would be a great fit for our team at Rise and Shine.</p>
          <p>We would love to learn more about you and discuss potential opportunities. Would you be available for a brief conversation?</p>
          <p>If you're interested, please reply to this email or contact us at your earliest convenience.</p>
          <p>Best regards,<br>The Rise and Shine Team</p>
        </div>
        <div class="footer">
          <p>Rise and Shine HRM</p>
        </div>
      </div>
    </body>
    </html>
  `
  return { subject, html }
}

export function generateInterviewInviteEmail(
  rbtProfile: {
    firstName: string
    lastName: string
    email: string | null
  },
  interview: {
    scheduledAt: Date
    durationMinutes: number
    interviewerName: string
    meetingUrl: string | null
  }
): { subject: string; html: string } {
  const formattedDate = new Date(interview.scheduledAt).toLocaleString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    timeZoneName: 'short',
  })

  const subject = 'Interview Invitation - Rise and Shine'
  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background-color: #E4893D; color: white; padding: 20px; text-align: center; }
        .content { padding: 20px; background-color: #f9f9f9; }
        .button { display: inline-block; padding: 12px 24px; background-color: #E4893D; color: white; text-decoration: none; border-radius: 4px; margin: 10px 0; }
        .footer { padding: 20px; text-align: center; font-size: 12px; color: #666; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>Rise and Shine</h1>
        </div>
        <div class="content">
          <p>Hello ${rbtProfile.firstName},</p>
          <p>Thank you for your interest in joining the Rise and Shine team. We would like to invite you for an interview.</p>
          <p><strong>Interview Details:</strong></p>
          <ul>
            <li><strong>Date & Time:</strong> ${formattedDate}</li>
            <li><strong>Duration:</strong> ${interview.durationMinutes} minutes</li>
            <li><strong>Interviewer:</strong> ${interview.interviewerName}</li>
          </ul>
          ${interview.meetingUrl ? `<p><a href="${interview.meetingUrl}" class="button">Join Meeting</a></p>` : ''}
          <p>If you need to reschedule, please contact us as soon as possible.</p>
          <p>We look forward to speaking with you!</p>
          <p>Best regards,<br>The Rise and Shine Team</p>
        </div>
        <div class="footer">
          <p>Rise and Shine HRM</p>
        </div>
      </div>
    </body>
    </html>
  `
  return { subject, html }
}

export function generateOfferEmail(rbtProfile: {
  firstName: string
  lastName: string
  email: string | null
}): { subject: string; html: string } {
  const subject = 'Welcome to Rise and Shine - You\'re Hired!'
  const portalUrl = process.env.NEXTAUTH_URL || process.env.VERCEL_URL 
    ? `${process.env.NEXTAUTH_URL || `https://${process.env.VERCEL_URL}`}`
    : 'http://localhost:3000'
  
  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <style>
        body { 
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif; 
          line-height: 1.6; 
          color: #333; 
          margin: 0;
          padding: 0;
        }
        .container { 
          max-width: 600px; 
          margin: 0 auto; 
          padding: 0;
        }
        .header { 
          background: linear-gradient(135deg, #E4893D 0%, #FF9F5A 100%);
          color: white; 
          padding: 40px 20px; 
          text-align: center; 
          border-radius: 12px 12px 0 0;
        }
        .header h1 {
          margin: 0;
          font-size: 32px;
          font-weight: bold;
        }
        .content { 
          padding: 30px 20px; 
          background-color: #ffffff; 
        }
        .content p {
          margin: 16px 0;
        }
        .content ul, .content ol {
          margin: 16px 0;
          padding-left: 24px;
        }
        .content li {
          margin: 8px 0;
        }
        .login-button {
          display: inline-block;
          background: linear-gradient(135deg, #E4893D 0%, #FF9F5A 100%);
          color: white;
          padding: 16px 32px;
          text-decoration: none;
          border-radius: 8px;
          font-weight: bold;
          margin: 24px 0;
          box-shadow: 0 4px 12px rgba(228, 137, 61, 0.3);
          transition: transform 0.2s;
        }
        .login-button:hover {
          transform: translateY(-2px);
        }
        .email-box {
          background-color: #f8f9fa;
          border: 2px dashed #E4893D;
          border-radius: 8px;
          padding: 16px;
          margin: 20px 0;
          text-align: center;
        }
        .email-box strong {
          color: #E4893D;
          font-size: 18px;
        }
        .steps-box {
          background-color: #fff5f0;
          border-left: 4px solid #E4893D;
          padding: 20px;
          margin: 20px 0;
          border-radius: 4px;
        }
        .footer { 
          padding: 24px 20px; 
          text-align: center; 
          font-size: 12px; 
          color: #666;
          background-color: #f9f9f9;
          border-radius: 0 0 12px 12px;
        }
        .celebrate {
          font-size: 24px;
          margin: 10px 0;
        }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>Congratulations!</h1>
          <p style="margin: 10px 0 0 0; font-size: 18px; opacity: 0.95;">You're Hired!</p>
        </div>
        <div class="content">
          <p>Hello <strong>${rbtProfile.firstName}</strong>,</p>
          <p>We are thrilled to offer you a position at <strong>Rise and Shine</strong>! We were impressed with your interview and believe you will be a valuable addition to our team.</p>
          
          <div class="steps-box">
            <p style="margin-top: 0;"><strong>Next Steps:</strong></p>
            <p>You can now log in to the Rise and Shine HRM portal to complete your onboarding. This includes:</p>
            <ul style="margin-bottom: 0;">
              <li>HIPAA compliance documentation</li>
              <li>Training videos and courses</li>
              <li>Setting up your profile</li>
              <li>Reviewing company policies</li>
            </ul>
          </div>

          <p><strong>To get started:</strong></p>
          <div style="text-align: center;">
            <a href="${portalUrl}" class="login-button">Log In to HRM Portal</a>
          </div>

          <div class="email-box">
            <p style="margin: 0 0 8px 0;">Your login email:</p>
            <strong>${rbtProfile.email || 'your registered email'}</strong>
          </div>

          <p><strong>Login Instructions:</strong></p>
          <ol>
            <li>Click the "Log In to HRM Portal" button above (or visit: <a href="${portalUrl}">${portalUrl}</a>)</li>
            <li>Enter your email address: <strong>${rbtProfile.email || 'your registered email'}</strong></li>
            <li>You will receive a verification code via email</li>
            <li>Enter the code to access your onboarding dashboard</li>
          </ol>

          <p>Please log in at your earliest convenience to begin the onboarding process. We're excited to have you on the team, ${rbtProfile.firstName}!</p>
          
          <p style="margin-top: 32px;">Best regards,<br><strong>The Rise and Shine Team</strong></p>
        </div>
        <div class="footer">
          <p><strong>Rise and Shine</strong> - HRM Portal</p>
          <p style="margin: 4px 0 0 0; font-size: 11px;">This is an automated email. Please do not reply directly.</p>
        </div>
      </div>
    </body>
    </html>
  `
  return { subject, html }
}

export function generateRejectionEmail(rbtProfile: {
  firstName: string
  lastName: string
  email: string | null
}): { subject: string; html: string } {
  const subject = 'Update on Your Application - Rise and Shine'
  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background-color: #E4893D; color: white; padding: 20px; text-align: center; }
        .content { padding: 20px; background-color: #f9f9f9; }
        .footer { padding: 20px; text-align: center; font-size: 12px; color: #666; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>Rise and Shine</h1>
        </div>
        <div class="content">
          <p>Hello ${rbtProfile.firstName},</p>
          <p>Thank you for taking the time to interview with us at Rise and Shine. We appreciate your interest in joining our team.</p>
          <p>After careful consideration, we have decided to move forward with other candidates at this time. We wish you the best in your career search.</p>
          <p>Best regards,<br>The Rise and Shine Team</p>
        </div>
        <div class="footer">
          <p>Rise and Shine HRM</p>
        </div>
      </div>
    </body>
    </html>
  `
  return { subject, html }
}

