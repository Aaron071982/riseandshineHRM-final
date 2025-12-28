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
    console.log(`⚠️ [DEV MODE] Resend not configured. Email would be sent to ${options.to}:`)
    console.log(`Subject: ${options.subject}`)
    console.log(`RESEND_API_KEY is: ${process.env.RESEND_API_KEY ? 'SET' : 'NOT SET'}`)
    console.log(`Email logged to database but NOT sent. Add RESEND_API_KEY to .env to send real emails.`)
    return true
  }
  
  console.log(`📧 Attempting to send email to ${options.to} via Resend...`)

  try {
    const result = await resend.emails.send({
      from: emailFrom,
      to: options.to,
      subject: options.subject,
      html: options.html,
      reply_to: emailFrom, // Add reply-to header
      headers: {
        'X-Entity-Ref-ID': options.rbtProfileId, // Track emails per RBT
      },
    })
    
    console.log(`✅ Email sent successfully to ${options.to}:`, result)
    
    // Update email log status with actual result
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
      
      // Check for specific Resend API limitations
      const error = result.error as any
      if (error.statusCode === 403) {
        if (error.message?.includes('only send testing emails to your own email address')) {
          console.error('⚠️ RESEND LIMITATION: You are using the test domain (onboarding@resend.dev) which only allows sending to your own verified email address.')
          console.error('💡 SOLUTION: Verify a domain in Resend (https://resend.com/domains) and update EMAIL_FROM in .env to use that domain.')
          console.error('   Example: EMAIL_FROM=noreply@yourdomain.com')
        } else {
          console.error(`⚠️ Resend API 403 Error: ${error.message}`)
          console.error('💡 Check: Is your domain verified in Resend? Go to https://resend.com/domains')
          console.error(`   Current EMAIL_FROM: ${emailFrom}`)
        }
      } else if (error.statusCode === 422) {
        console.error(`⚠️ Resend API 422 Error (Validation): ${error.message}`)
        console.error(`   From: ${emailFrom}`)
        console.error(`   To: ${options.to}`)
      } else {
        console.error(`⚠️ Resend API Error (${error.statusCode || 'unknown'}): ${error.message || 'Unknown error'}`)
      }
      
      // Update email log with error
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
  } catch (error: any) {
    console.error('❌ Error sending email via Resend:', error)
    console.error('Error details:', {
      message: error?.message,
      name: error?.name,
      stack: error?.stack,
    })
    
    // Update email log status to failed
    try {
      await prisma.interviewEmailLog.updateMany({
        where: {
          rbtProfileId: options.rbtProfileId,
          toEmail: options.to,
          subject: options.subject,
        },
        data: {
          status: `failed: ${error?.message || 'unknown error'}`,
        },
      })
    } catch (updateError) {
      console.error('Error updating email log status:', updateError)
    }
    
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
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <style>
        body { 
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif; 
          line-height: 1.6; 
          color: #333; 
          margin: 0;
          padding: 0;
          background-color: #f5f5f5;
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
          font-size: 28px;
          font-weight: bold;
        }
        .content { 
          padding: 30px 20px; 
          background-color: #ffffff; 
        }
        .content p {
          margin: 16px 0;
        }
        .footer { 
          padding: 24px 20px; 
          text-align: center; 
          font-size: 12px; 
          color: #666;
          background-color: #f9f9f9;
          border-radius: 0 0 12px 12px;
        }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>Rise and Shine</h1>
          <p style="margin: 8px 0 0 0; font-size: 16px; opacity: 0.95;">HRM Portal</p>
        </div>
        <div class="content">
          <p>Hello <strong>${rbtProfile.firstName}</strong>,</p>
          <p>We hope this message finds you well. We came across your profile and believe you would be a great fit for our team at <strong>Rise and Shine</strong>.</p>
          <p>We are always looking for talented and dedicated individuals who share our passion for providing exceptional care. We would love to learn more about you and discuss potential opportunities that align with your skills and career goals.</p>
          <p>Would you be available for a brief conversation at your convenience? We're excited about the possibility of you joining our team.</p>
          <p>If you're interested in learning more, please reply to this email or contact us at your earliest convenience. We look forward to hearing from you!</p>
          <p style="margin-top: 32px;">Best regards,<br><strong>The Rise and Shine Team</strong></p>
        </div>
        <div class="footer">
          <p><strong>Rise and Shine</strong> - HRM Portal</p>
          <p style="margin: 4px 0 0 0; font-size: 11px;">This is an automated email. Please reply directly if you have any questions.</p>
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
    timeZone: 'America/New_York',
  })

  const formattedTime = new Date(interview.scheduledAt).toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    timeZoneName: 'short',
    timeZone: 'America/New_York',
  })

  const subject = 'Interview Invitation - Rise and Shine'
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
          font-size: 28px;
          font-weight: bold;
        }
        .content { 
          padding: 30px 20px; 
          background-color: #ffffff; 
        }
        .content p {
          margin: 16px 0;
        }
        .interview-details {
          background-color: #fff5f0;
          border-left: 4px solid #E4893D;
          padding: 20px;
          margin: 24px 0;
          border-radius: 4px;
        }
        .interview-details ul {
          list-style: none;
          padding: 0;
          margin: 0;
        }
        .interview-details li {
          margin: 12px 0;
          padding-left: 24px;
          position: relative;
        }
        .interview-details li strong {
          display: inline-block;
          min-width: 120px;
          color: #E4893D;
        }
        .button { 
          display: inline-block; 
          padding: 14px 32px; 
          background: linear-gradient(135deg, #E4893D 0%, #FF9F5A 100%);
          color: white; 
          text-decoration: none; 
          border-radius: 8px; 
          margin: 16px 0;
          font-weight: bold;
          box-shadow: 0 4px 12px rgba(228, 137, 61, 0.3);
        }
        .reminder-box {
          background-color: #fff5f0;
          border: 2px solid #E4893D;
          border-radius: 8px;
          padding: 16px;
          margin: 24px 0;
          text-align: center;
        }
        .reminder-box strong {
          color: #E4893D;
          font-size: 16px;
        }
        .footer { 
          padding: 24px 20px; 
          text-align: center; 
          font-size: 12px; 
          color: #666;
          background-color: #f9f9f9;
          border-radius: 0 0 12px 12px;
        }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>Interview Invitation</h1>
          <p style="margin: 8px 0 0 0; font-size: 16px; opacity: 0.95;">Rise and Shine</p>
        </div>
        <div class="content">
          <p>Hello <strong>${rbtProfile.firstName}</strong>,</p>
          <p>Thank you for your interest in joining the <strong>Rise and Shine</strong> team. We were impressed with your application and would like to invite you for an interview.</p>
          
          <div class="interview-details">
            <p style="margin-top: 0; font-weight: bold; color: #E4893D; font-size: 18px;">Interview Details:</p>
            <ul>
              <li><strong>Date:</strong> ${new Date(interview.scheduledAt).toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</li>
              <li><strong>Time:</strong> ${formattedTime}</li>
              <li><strong>Duration:</strong> ${interview.durationMinutes} minutes</li>
              <li><strong>Interviewer:</strong> ${interview.interviewerName}</li>
            </ul>
          </div>

          ${interview.meetingUrl ? `
          <div style="text-align: center; margin: 24px 0;">
            <a href="${interview.meetingUrl}" class="button">Join Meeting</a>
          </div>
          <p style="text-align: center; font-size: 14px; color: #666;">
            Meeting Link: <a href="${interview.meetingUrl}" style="color: #E4893D;">${interview.meetingUrl}</a>
          </p>
          ` : ''}

          <div class="reminder-box">
            <p style="margin: 0;"><strong>Important:</strong> Please arrive on time for your interview. We recommend joining a few minutes early to ensure everything is working properly.</p>
          </div>

          <p><strong>What to Expect:</strong></p>
          <ul>
            <li>We'll discuss your experience and qualifications</li>
            <li>You'll learn more about the role and our company</li>
            <li>We'll answer any questions you may have</li>
          </ul>

          <p>If you need to reschedule or have any questions, please contact us as soon as possible so we can make alternative arrangements.</p>
          
          <p>We look forward to speaking with you, ${rbtProfile.firstName}!</p>
          
          <p style="margin-top: 32px;">Best regards,<br><strong>The Rise and Shine Team</strong></p>
        </div>
        <div class="footer">
          <p><strong>Rise and Shine</strong> - HRM Portal</p>
          <p style="margin: 4px 0 0 0; font-size: 11px;">This is an automated email. Please contact us if you have any questions.</p>
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

          <p><strong>To get started, please sign in to the Rise and Shine HRM portal:</strong></p>
          <div style="text-align: center;">
            <a href="https://riseandshinehrm.com" class="login-button">Sign In at riseandshinehrm.com</a>
          </div>

          <div class="email-box">
            <p style="margin: 0 0 8px 0;">Your login email:</p>
            <strong>${rbtProfile.email || 'your registered email'}</strong>
          </div>

          <p><strong>Login Instructions:</strong></p>
          <ol>
            <li>Visit <strong>riseandshinehrm.com</strong> in your web browser</li>
            <li>Enter your email address: <strong>${rbtProfile.email || 'your registered email'}</strong></li>
            <li>Check your email inbox for the verification code (do not check your screen - the code will only be sent via email)</li>
            <li>Enter the 6-digit verification code to access your onboarding dashboard</li>
          </ol>
          
          <p><strong>Important:</strong> After signing in, you'll be able to download the onboarding package, complete your documents, and upload them back to the portal.</p>

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
          font-size: 28px;
          font-weight: bold;
        }
        .content { 
          padding: 30px 20px; 
          background-color: #ffffff; 
        }
        .content p {
          margin: 16px 0;
        }
        .footer { 
          padding: 24px 20px; 
          text-align: center; 
          font-size: 12px; 
          color: #666;
          background-color: #f9f9f9;
          border-radius: 0 0 12px 12px;
        }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>Rise and Shine</h1>
        </div>
        <div class="content">
          <p>Hello <strong>${rbtProfile.firstName}</strong>,</p>
          <p>Thank you for taking the time to interview with us at <strong>Rise and Shine</strong>. We truly appreciate your interest in joining our team and the time you invested in the application process.</p>
          <p>After careful consideration of all candidates, we have made the difficult decision to move forward with other applicants whose qualifications more closely align with our current needs.</p>
          <p>This decision was not easy, and we want you to know that we were impressed by your background and enthusiasm. We encourage you to continue pursuing opportunities in the field, as we believe you have much to offer.</p>
          <p>We wish you the very best in your career search and future endeavors. Please don't hesitate to reach out if you have any questions.</p>
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

