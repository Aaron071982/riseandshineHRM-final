import { makePublicUrl } from '../baseUrl'
import { formatPhoneNumber } from '../sms'

export function generateApplicationReviewedEmail(firstName: string): { subject: string; html: string } {
  const subject = "We've reviewed your application - Rise and Shine"
  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; background-color: #f5f5f5; }
        .container { max-width: 600px; margin: 0 auto; padding: 0; }
        .header { background: linear-gradient(135deg, #E4893D 0%, #FF9F5A 100%); color: white; padding: 40px 20px; text-align: center; border-radius: 12px 12px 0 0; }
        .header h1 { margin: 0; font-size: 28px; font-weight: bold; }
        .content { padding: 30px 20px; background-color: #ffffff; }
        .content p { margin: 16px 0; }
        .footer { padding: 24px 20px; text-align: center; font-size: 12px; color: #666; background-color: #f9f9f9; border-radius: 0 0 12px 12px; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>Rise and Shine</h1>
          <p style="margin: 8px 0 0 0; font-size: 16px; opacity: 0.95;">HRM Portal</p>
        </div>
        <div class="content">
          <p>Hello <strong>${firstName}</strong>,</p>
          <p>We've reviewed your application and would like to connect with you.</p>
          <p>Our team will be in touch shortly to discuss next steps.</p>
          <p style="margin-top: 32px;">Best regards,<br><strong>The Rise and Shine Team</strong></p>
          <p style="margin-top: 24px; padding-top: 24px; border-top: 1px solid #eee; color: #666; font-size: 14px;">
            Questions? Contact <a href="mailto:info@riseandshine.nyc" style="color: #E4893D; text-decoration: none;">info@riseandshine.nyc</a>
          </p>
        </div>
        <div class="footer">
          <p><strong>Rise and Shine</strong> - HRM Portal</p>
        </div>
      </div>
    </body>
    </html>
  `
  return { subject, html }
}

export function generateReachOutEmail(
  rbtProfile: {
    firstName: string
    lastName: string
    email: string | null
    id: string
  },
  schedulingToken: string
): { subject: string; html: string } {
  const scheduleUrl = makePublicUrl(`/schedule-interview?token=${schedulingToken}&rbtId=${rbtProfile.id}`)
  
  const subject = 'Opportunity at Rise and Shine - Schedule Your Interview!'
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
        .info-box {
          background-color: #FFF5F0;
          border-left: 4px solid #E4893D;
          padding: 16px;
          margin: 24px 0;
          border-radius: 4px;
        }
        .info-box strong {
          color: #E4893D;
        }
        .cta-button {
          display: inline-block;
          background: linear-gradient(135deg, #E4893D 0%, #FF9F5A 100%);
          color: white !important;
          padding: 16px 32px;
          text-decoration: none;
          border-radius: 8px;
          font-weight: 600;
          font-size: 16px;
          margin: 24px 0;
          text-align: center;
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
          
          <div class="info-box">
            <p style="margin: 0 0 8px 0;"><strong>Next Steps:</strong></p>
            <p style="margin: 0;">Schedule an interview with us! Interviews are available:</p>
            <ul style="margin: 8px 0 0 20px; padding: 0;">
              <li><strong>Days:</strong> Sunday through Thursday</li>
              <li><strong>Time:</strong> 11:00 AM to 2:00 PM</li>
              <li><strong>Duration:</strong> 15 minutes</li>
            </ul>
          </div>
          
          <div style="text-align: center;">
            <a href="${scheduleUrl}" class="cta-button">Schedule Your Interview</a>
          </div>
          
          <p>If you have any questions or prefer to schedule at a different time, please reply to this email and we'll work with you to find a suitable time.</p>
          <p style="margin-top: 32px;">Best regards,<br><strong>The Rise and Shine Team</strong></p>
          <p style="margin-top: 24px; padding-top: 24px; border-top: 1px solid #eee; color: #666; font-size: 14px;">
            If you have any questions, reach out to <a href="mailto:info@riseandshine.nyc" style="color: #E4893D; text-decoration: none;">info@riseandshine.nyc</a>
          </p>
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
    interviewId?: string
    calendarToken?: string
    /** Self-serve reschedule link (opens scheduler with reschedule mode) */
    rescheduleUrl?: string
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

  const interviewEndTime = new Date(interview.scheduledAt.getTime() + interview.durationMinutes * 60 * 1000)
  const formatGoogleDateForUrl = (d: Date) => d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z')
  const googleCalendarUrl = `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(
    `Rise and Shine Interview (${interview.interviewerName})`
  )}&dates=${formatGoogleDateForUrl(interview.scheduledAt)}/${formatGoogleDateForUrl(interviewEndTime)}&details=${encodeURIComponent(
    'Rise and Shine ABA interview'
  )}&location=${encodeURIComponent(interview.meetingUrl || '')}`

  const icsCalendarDownloadUrl =
    interview.calendarToken && interview.interviewId
      ? makePublicUrl(
          `/api/public/calendar/ics?token=${encodeURIComponent(interview.calendarToken)}&interviewId=${encodeURIComponent(interview.interviewId)}`
        )
      : null

  const subject = 'Interview Confirmed — Rise and Shine ABA'
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
          <h1>Interview Confirmed</h1>
          <p style="margin: 8px 0 0 0; font-size: 16px; opacity: 0.95;">Rise and Shine</p>
        </div>
        <div class="content">
          <p>Hello <strong>${rbtProfile.firstName}</strong>,</p>
          <p>Thank you for your interest in joining the <strong>Rise and Shine</strong> team. We&apos;ve confirmed your interview below.</p>
          
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

          <div style="text-align: center; margin: 20px 0;">
            <a href="${googleCalendarUrl}" class="button">Add to Google Calendar</a>
            ${
              icsCalendarDownloadUrl
                ? `<div style="margin-top: 12px;"><a href="${icsCalendarDownloadUrl}" class="button">Download calendar file (.ics)</a></div>
                   <p style="margin: 8px 0 0 0; font-size: 13px; color: #666;">Works with Apple Calendar, Microsoft Outlook, and other apps that open .ics files.</p>`
                : ''
            }
          </div>

          ${
            interview.rescheduleUrl
              ? `<div style="text-align: center; margin: 24px 0;">
                   <p style="margin: 0 0 12px 0; font-size: 15px; color: #333;"><strong>Need a different time?</strong></p>
                   <a href="${interview.rescheduleUrl}" class="button">Reschedule interview</a>
                   <p style="margin: 12px 0 0 0; font-size: 13px; color: #666;">Pick a new slot; your previous time will be canceled automatically.</p>
                 </div>`
              : ''
          }

          <div class="reminder-box">
            <p style="margin: 0;"><strong>Important:</strong> Please arrive on time for your interview. We recommend joining a few minutes early to ensure everything is working properly.</p>
          </div>

          <p><strong>What to Expect:</strong></p>
          <ul>
            <li>We'll discuss your experience and qualifications</li>
            <li>You'll learn more about the role and our company</li>
            <li>We'll answer any questions you may have</li>
          </ul>

          <p>We look forward to speaking with you, ${rbtProfile.firstName}!</p>
          
          <p style="margin-top: 32px;">Best regards,<br><strong>The Rise and Shine Team</strong></p>
          <p style="margin-top: 24px; padding-top: 24px; border-top: 1px solid #eee; color: #666; font-size: 14px;">
            If you have any questions, reach out to <a href="mailto:info@riseandshine.nyc" style="color: #E4893D; text-decoration: none;">info@riseandshine.nyc</a>
          </p>
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
          <p style="margin-top: 24px; padding-top: 24px; border-top: 1px solid #eee; color: #666; font-size: 14px;">
            If you have any questions, reach out to <a href="mailto:info@riseandshine.nyc" style="color: #E4893D; text-decoration: none;">info@riseandshine.nyc</a>
          </p>
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

/** Thank-you email for new non-RBT team members (BCBA, Billing, Marketing, Call Center, Dev). */
export function generateTeamWelcomeEmail(fullName: string, roleLabel: string): { subject: string; html: string } {
  const subject = 'Thank you for joining Rise and Shine!'
  const firstName = fullName.trim().split(/\s+/)[0] || fullName
  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; }
        .container { max-width: 600px; margin: 0 auto; padding: 0; }
        .header { background: linear-gradient(135deg, #E4893D 0%, #FF9F5A 100%); color: white; padding: 40px 20px; text-align: center; border-radius: 12px 12px 0 0; }
        .header h1 { margin: 0; font-size: 28px; font-weight: bold; }
        .content { padding: 30px 20px; background-color: #ffffff; }
        .content p { margin: 16px 0; }
        .footer { padding: 24px 20px; text-align: center; font-size: 12px; color: #666; background-color: #f9f9f9; border-radius: 0 0 12px 12px; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>Welcome to the team</h1>
          <p style="margin: 8px 0 0 0; font-size: 16px; opacity: 0.95;">Rise and Shine</p>
        </div>
        <div class="content">
          <p>Hello <strong>${firstName}</strong>,</p>
          <p>Thank you for joining us at <strong>Rise and Shine</strong>. We are excited to have you on our ${roleLabel} team.</p>
          <p>If you have any questions or need anything to get started, please don't hesitate to reach out.</p>
          <p style="margin-top: 32px;">Best regards,<br><strong>The Rise and Shine Team</strong></p>
          <p style="margin-top: 24px; padding-top: 24px; border-top: 1px solid #eee; color: #666; font-size: 14px;">
            Contact us at <a href="mailto:info@riseandshine.nyc" style="color: #E4893D; text-decoration: none;">info@riseandshine.nyc</a>
          </p>
        </div>
        <div class="footer">
          <p><strong>Rise and Shine</strong> - HRM</p>
        </div>
      </div>
    </body>
    </html>
  `
  return { subject, html }
}

/** Welcome + "You're hired!" + onboarding email for RBTs hired manually (no interview). Mentions 40-hour course access when needed. */
export function generateManualHireOnboardingEmail(
  rbtProfile: { firstName: string; lastName: string; email: string | null },
  fortyHourCourseCompleted: boolean
): { subject: string; html: string } {
  const loginUrl = makePublicUrl('/login')
  const subject = "Welcome to Rise and Shine – You're Hired!"
  const fortyHourParagraph = !fortyHourCourseCompleted
    ? `<p><strong>40-Hour RBT Course:</strong> If you have not yet completed the 40-hour RBT course, you will have access to it in your onboarding dashboard. Log in, complete the course, and upload your certificate there.</p>`
    : ''
  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; }
        .container { max-width: 600px; margin: 0 auto; padding: 0; }
        .header { background: linear-gradient(135deg, #E4893D 0%, #FF9F5A 100%); color: white; padding: 40px 20px; text-align: center; border-radius: 12px 12px 0 0; }
        .header h1 { margin: 0; font-size: 32px; font-weight: bold; }
        .content { padding: 30px 20px; background-color: #ffffff; }
        .content p { margin: 16px 0; }
        .content ul, .content ol { margin: 16px 0; padding-left: 24px; }
        .login-button { display: inline-block; background: linear-gradient(135deg, #E4893D 0%, #FF9F5A 100%); color: white; padding: 16px 32px; text-decoration: none; border-radius: 8px; font-weight: bold; margin: 24px 0; }
        .steps-box { background-color: #fff5f0; border-left: 4px solid #E4893D; padding: 20px; margin: 20px 0; border-radius: 4px; }
        .footer { padding: 24px 20px; text-align: center; font-size: 12px; color: #666; background-color: #f9f9f9; border-radius: 0 0 12px 12px; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>You're Hired!</h1>
          <p style="margin: 10px 0 0 0; font-size: 18px; opacity: 0.95;">Welcome to Rise and Shine</p>
        </div>
        <div class="content">
          <p>Hello <strong>${rbtProfile.firstName}</strong>,</p>
          <p><strong>Welcome to Rise and Shine – you're hired!</strong> We're excited to have you on the team as an RBT. Please log into the HRM portal and complete your onboarding so you're ready to go.</p>
          <div class="steps-box">
            <p style="margin-top: 0;"><strong>Next steps:</strong></p>
            <ul style="margin-bottom: 0;">
              <li>Log in to the Rise and Shine HRM portal (link below)</li>
              <li>Complete all onboarding tasks (HIPAA materials, Social Security card upload, digital signature)</li>
              <li>Upload a clear photo or scan of your Social Security card where prompted (My Tasks / onboarding)</li>
              <li>If you have not completed the 40-hour RBT course, you will see it in your onboarding—complete it and upload your certificate</li>
            </ul>
          </div>
          <p><strong>Log in to start onboarding:</strong></p>
          <p><a href="${loginUrl}" class="login-button">Log in to HRM</a></p>
          <p>Use your email <strong>${rbtProfile.email || 'your registered email'}</strong>. You will receive a verification code by email to sign in.</p>
          ${fortyHourParagraph}
          <p style="margin-top: 32px;">Best regards,<br><strong>The Rise and Shine Team</strong></p>
          <p style="margin-top: 24px; padding-top: 24px; border-top: 1px solid #eee; color: #666; font-size: 14px;">
            Questions? <a href="mailto:info@riseandshine.nyc" style="color: #E4893D; text-decoration: none;">info@riseandshine.nyc</a>
          </p>
        </div>
        <div class="footer">
          <p><strong>Rise and Shine</strong> - HRM Portal</p>
        </div>
      </div>
    </body>
    </html>
  `
  return { subject, html }
}

/** Email asking hired RBT to send their ID to info@riseandshine.nyc */
export function generateIdReminderEmail(fullName: string): { subject: string; html: string } {
  const subject = 'Rise and Shine – Please send your ID'
  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; }
        .container { max-width: 600px; margin: 0 auto; padding: 0; }
        .header { background: linear-gradient(135deg, #E4893D 0%, #FF9F5A 100%); color: white; padding: 40px 20px; text-align: center; border-radius: 12px 12px 0 0; }
        .header h1 { margin: 0; font-size: 28px; font-weight: bold; }
        .content { padding: 30px 20px; background-color: #ffffff; }
        .content p { margin: 16px 0; }
        .highlight { background-color: #fff5f0; border-left: 4px solid #E4893D; padding: 16px 20px; margin: 20px 0; border-radius: 4px; }
        .footer { padding: 24px 20px; text-align: center; font-size: 12px; color: #666; background-color: #f9f9f9; border-radius: 0 0 12px 12px; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>Rise and Shine</h1>
          <p style="margin: 10px 0 0 0; font-size: 16px; opacity: 0.95;">Please send your ID</p>
        </div>
        <div class="content">
          <p>Hello ${fullName},</p>
          <p>Thank you for joining Rise and Shine. To complete our records, please email a copy of your <strong>government-issued ID</strong> to:</p>
          <div class="highlight">
            <p style="margin: 0; font-size: 18px;"><strong><a href="mailto:info@riseandshine.nyc" style="color: #E4893D; text-decoration: none;">info@riseandshine.nyc</a></strong></p>
          </div>
          <p>You can reply to this email and attach your ID, or send a new email to the address above. We accept a clear photo or scan of your driver’s license, state ID, or passport.</p>
          <p>If you have already sent your ID, please disregard this message.</p>
          <p style="margin-top: 32px;">Best regards,<br><strong>The Rise and Shine Team</strong></p>
        </div>
        <div class="footer">
          <p><strong>Rise and Shine</strong></p>
        </div>
      </div>
    </body>
    </html>
  `
  return { subject, html }
}

/** Reminder to upload Social Security card via HRM onboarding (My Tasks). */
export function generateSocialSecurityUploadReminderEmail(
  firstName: string,
  tasksUrl: string
): { subject: string; html: string } {
  const subject = 'Action required: Upload your Social Security card – Rise and Shine'
  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; }
        .container { max-width: 600px; margin: 0 auto; padding: 0; }
        .header { background: linear-gradient(135deg, #E4893D 0%, #FF9F5A 100%); color: white; padding: 40px 20px; text-align: center; border-radius: 12px 12px 0 0; }
        .header h1 { margin: 0; font-size: 28px; font-weight: bold; }
        .content { padding: 30px 20px; background-color: #ffffff; }
        .content p { margin: 16px 0; }
        .cta { display: inline-block; margin: 20px 0; padding: 14px 28px; background-color: #E4893D; color: white !important; text-decoration: none; border-radius: 8px; font-weight: 600; }
        .highlight { background-color: #fff5f0; border-left: 4px solid #E4893D; padding: 16px 20px; margin: 20px 0; border-radius: 4px; }
        .footer { padding: 24px 20px; text-align: center; font-size: 12px; color: #666; background-color: #f9f9f9; border-radius: 0 0 12px 12px; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>Rise and Shine</h1>
          <p style="margin: 10px 0 0 0; font-size: 16px; opacity: 0.95;">Complete your onboarding</p>
        </div>
        <div class="content">
          <p>Hello <strong>${firstName}</strong>,</p>
          <p>We need one more item to finish your onboarding: a clear upload of your <strong>Social Security card</strong> (photo or scan). This is required for payroll and employment records.</p>
          <div class="highlight">
            <p style="margin: 0;"><strong>Accepted formats:</strong> PDF, JPG, or PNG (max 10MB).</p>
          </div>
          <p>Please log in to the HRM portal and open <strong>My Tasks</strong> to upload your card. If you have other onboarding steps pending, you can complete those in the same place.</p>
          <p style="text-align: center;">
            <a href="${tasksUrl}" class="cta">Open My Tasks</a>
          </p>
          <p>If you have already uploaded your Social Security card through the portal, you can ignore this email.</p>
          <p style="margin-top: 32px;">Questions? Contact <a href="mailto:info@riseandshine.nyc" style="color: #E4893D;">info@riseandshine.nyc</a></p>
          <p>Best regards,<br><strong>The Rise and Shine Team</strong></p>
        </div>
        <div class="footer">
          <p><strong>Rise and Shine</strong> – HRM Portal</p>
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
          <p style="margin-top: 24px; padding-top: 24px; border-top: 1px solid #eee; color: #666; font-size: 14px;">
            If you have any questions, reach out to <a href="mailto:info@riseandshine.nyc" style="color: #E4893D; text-decoration: none;">info@riseandshine.nyc</a>
          </p>
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

export function generateMissingOnboardingEmail(
  rbtProfile: {
    firstName: string
    lastName: string
    email: string | null
  },
  incompleteTasks: Array<{
    title: string
    description: string | null
    taskType: string
  }>
): { subject: string; html: string } {
  const dashboardUrl = makePublicUrl('/rbt/dashboard')
  const subject = `Action Required: Complete Your Onboarding - ${rbtProfile.firstName}`
  
  const tasksList = incompleteTasks.length > 0
    ? incompleteTasks.map(task => `<li><strong>${task.title}</strong>${task.description ? ` - ${task.description}` : ''}</li>`).join('\n')
    : '<li>Complete all pending onboarding items</li>'
  
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
        .warning-box {
          background-color: #FFF5F0;
          border-left: 4px solid #E4893D;
          padding: 16px;
          margin: 24px 0;
          border-radius: 4px;
        }
        .warning-box strong {
          color: #E4893D;
        }
        .tasks-list {
          background-color: #f9f9f9;
          border: 1px solid #e0e0e0;
          border-radius: 8px;
          padding: 20px;
          margin: 24px 0;
        }
        .tasks-list ul {
          margin: 0;
          padding-left: 20px;
        }
        .tasks-list li {
          margin: 12px 0;
          color: #555;
        }
        .cta-button {
          display: inline-block;
          background: linear-gradient(135deg, #E4893D 0%, #FF9F5A 100%);
          color: white !important;
          padding: 16px 32px;
          text-decoration: none;
          border-radius: 8px;
          font-weight: 600;
          font-size: 16px;
          margin: 24px 0;
          text-align: center;
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
          <p>We noticed you haven't completed all onboarding requirements. Please complete the following items quickly:</p>
          
          <div class="warning-box">
            <p style="margin: 0 0 8px 0;"><strong>Action Required:</strong></p>
            <p style="margin: 0;">Please complete the missing onboarding items as soon as possible to ensure you're fully onboarded and ready to start.</p>
          </div>
          
          <div class="tasks-list">
            <p style="margin: 0 0 12px 0; font-weight: bold; color: #333;">Missing Onboarding Items:</p>
            <ul>
              ${tasksList}
            </ul>
          </div>
          
          <div style="text-align: center;">
            <a href="${dashboardUrl}" class="cta-button">Complete Onboarding Now</a>
          </div>
          
          <p><strong>Login Instructions:</strong></p>
          <ol>
            <li>Visit <strong>riseandshinehrm.com</strong> in your web browser</li>
            <li>Enter your email address: <strong>${rbtProfile.email || 'your registered email'}</strong></li>
            <li>Check your email inbox for the verification code</li>
            <li>Enter the 6-digit verification code to access your onboarding dashboard</li>
          </ol>
          
          <p>Once you log in, you'll see all pending onboarding items and can complete them at your convenience.</p>
          
          <p style="margin-top: 32px;">Best regards,<br><strong>The Rise and Shine Team</strong></p>
          <p style="margin-top: 24px; padding-top: 24px; border-top: 1px solid #eee; color: #666; font-size: 14px;">
            If you have any questions, reach out to <a href="mailto:info@riseandshine.nyc" style="color: #E4893D; text-decoration: none;">info@riseandshine.nyc</a>
          </p>
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


export function generateApplicationSubmissionInternalEmail(rbtProfile: {
  firstName: string
  lastName: string
  email: string | null
  id: string
  resumeUrl: string | null
}): { subject: string; html: string } {
  const subject = `New RBT Application: ${rbtProfile.firstName} ${rbtProfile.lastName}`
  const adminPortalUrl = makePublicUrl(`/admin/rbts/${rbtProfile.id}`)
  
  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; }
        .container { max-width: 600px; margin: 0 auto; padding: 0; }
        .header { background: linear-gradient(135deg, #E4893D 0%, #FF9F5A 100%); color: white; padding: 40px 20px; text-align: center; border-radius: 12px 12px 0 0; }
        .header h1 { margin: 0; font-size: 28px; font-weight: bold; }
        .content { padding: 30px 20px; background-color: #ffffff; }
        .content p { margin: 16px 0; }
        .button { display: inline-block; padding: 14px 32px; background: linear-gradient(135deg, #E4893D 0%, #FF9F5A 100%); color: white; text-decoration: none; border-radius: 8px; margin: 16px 0; font-weight: bold; box-shadow: 0 4px 12px rgba(228, 137, 61, 0.3); }
        .info-box { background-color: #f8f9fa; border-left: 4px solid #E4893D; padding: 16px; margin: 20px 0; border-radius: 4px; }
        .footer { padding: 24px 20px; text-align: center; font-size: 12px; color: #666; background-color: #f9f9f9; border-radius: 0 0 12px 12px; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>New RBT Application</h1>
          <p style="margin: 8px 0 0 0; font-size: 16px; opacity: 0.95;">Rise and Shine HRM</p>
        </div>
        <div class="content">
          <p>A new RBT application has been submitted through the public careers site.</p>
          <div class="info-box">
            <p style="margin: 0 0 8px 0;"><strong>Candidate:</strong></p>
            <p style="margin: 0;"><strong>${rbtProfile.firstName} ${rbtProfile.lastName}</strong></p>
            <p style="margin: 8px 0 0 0;"><strong>Email:</strong> ${rbtProfile.email || 'Not provided'}</p>
            <p style="margin: 8px 0 0 0;"><strong>Application ID:</strong> ${rbtProfile.id}</p>
          </div>
          <div style="text-align: center; margin: 24px 0;">
            <a href="${adminPortalUrl}" class="button">View Application in HRM Portal</a>
          </div>
          <p>The candidate has been added to the RBT pipeline with status "NEW". You can review their application, download their resume, and proceed with the hiring process from the admin portal.</p>
          <p style="margin-top: 32px;">Best regards,<br><strong>Rise and Shine HRM System</strong></p>
          <p style="margin-top: 24px; padding-top: 24px; border-top: 1px solid #eee; color: #666; font-size: 14px;">
            If you have any questions, reach out to <a href="mailto:info@riseandshine.nyc" style="color: #E4893D; text-decoration: none;">info@riseandshine.nyc</a>
          </p>
        </div>
        <div class="footer">
          <p><strong>Rise and Shine</strong> - HRM Portal</p>
          <p style="margin: 4px 0 0 0; font-size: 11px;">This is an automated notification email.</p>
        </div>
      </div>
    </body>
    </html>
  `
  return { subject, html }
}

export function generateApplicationSubmissionConfirmationEmail(rbtProfile: {
  firstName: string
  lastName: string
  email: string | null
  id: string
}): { subject: string; html: string } {
  const subject = 'Thank You for Your Application - Rise & Shine'
  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; }
        .container { max-width: 600px; margin: 0 auto; padding: 0; }
        .header { background: linear-gradient(135deg, #E4893D 0%, #FF9F5A 100%); color: white; padding: 40px 20px; text-align: center; border-radius: 12px 12px 0 0; }
        .header h1 { margin: 0; font-size: 28px; font-weight: bold; }
        .content { padding: 30px 20px; background-color: #ffffff; }
        .content p { margin: 16px 0; }
        .reference-box { background-color: #f8f9fa; border: 2px dashed #E4893D; border-radius: 8px; padding: 16px; margin: 20px 0; text-align: center; }
        .reference-box strong { color: #E4893D; font-size: 18px; }
        .footer { padding: 24px 20px; text-align: center; font-size: 12px; color: #666; background-color: #f9f9f9; border-radius: 0 0 12px 12px; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>Application Received</h1>
          <p style="margin: 8px 0 0 0; font-size: 16px; opacity: 0.95;">Thank You, ${rbtProfile.firstName}!</p>
        </div>
        <div class="content">
          <p>Hello <strong>${rbtProfile.firstName}</strong>,</p>
          <p>Thank you for your interest in joining the <strong>Rise & Shine</strong> team. We have successfully received your application for the Registered Behavior Technician (RBT) position.</p>
          <div class="reference-box">
            <p style="margin: 0 0 8px 0;">Your Application Reference ID:</p>
            <strong>${rbtProfile.id}</strong>
          </div>
          <p><strong>What happens next?</strong></p>
          <ul>
            <li>Our team will review your application carefully</li>
            <li>If your qualifications align with our needs, we'll contact you to schedule an interview</li>
            <li>Please check your email regularly for updates</li>
          </ul>
          <p>We appreciate the time you took to complete the application, and we look forward to learning more about you. If you have any questions, please don't hesitate to reach out to us.</p>
          <p style="margin-top: 32px;">Best regards,<br><strong>The Rise & Shine Team</strong></p>
          <p style="margin-top: 24px; padding-top: 24px; border-top: 1px solid #eee; color: #666; font-size: 14px;">
            If you have any questions, reach out to <a href="mailto:info@riseandshine.nyc" style="color: #E4893D; text-decoration: none;">info@riseandshine.nyc</a>
          </p>
        </div>
        <div class="footer">
          <p><strong>Rise & Shine</strong> - HRM Portal</p>
          <p style="margin: 4px 0 0 0; font-size: 11px;">This is an automated confirmation email. Please do not reply directly.</p>
        </div>
      </div>
    </body>
    </html>
  `
  return { subject, html }
}

export function generateInterviewReminderEmail(
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
  },
  isForAdmin: boolean = false
): { subject: string; html: string } {
  const formattedDate = interview.scheduledAt.toLocaleString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    timeZone: 'America/New_York',
  })

  const subject = isForAdmin
    ? `Interview Reminder: ${rbtProfile.firstName} ${rbtProfile.lastName} - ${formattedDate}`
    : `Interview Reminder: Your interview is in 30 minutes`

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
        .reminder-box {
          background-color: #FFF5F0;
          border: 2px solid #E4893D;
          border-radius: 8px;
          padding: 20px;
          margin: 24px 0;
        }
        .reminder-box strong {
          color: #E4893D;
          font-size: 16px;
        }
        .info-row {
          margin: 12px 0;
          padding: 8px 0;
          border-bottom: 1px solid #eee;
        }
        .info-row:last-child {
          border-bottom: none;
        }
        .info-label {
          font-weight: 600;
          color: #666;
          display: inline-block;
          width: 120px;
        }
        .cta-button {
          display: inline-block;
          background: linear-gradient(135deg, #E4893D 0%, #FF9F5A 100%);
          color: white !important;
          padding: 16px 32px;
          text-decoration: none;
          border-radius: 8px;
          font-weight: 600;
          font-size: 16px;
          margin: 24px 0;
          text-align: center;
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
          <div class="reminder-box">
            <p style="margin: 0; font-size: 18px;"><strong>⏰ Interview Reminder</strong></p>
            <p style="margin: 8px 0 0 0;">Your interview is scheduled in 30 minutes!</p>
          </div>

          ${isForAdmin ? `<p>Hello Admin,</p><p>This is a reminder that an interview is scheduled to begin in 30 minutes:</p>` : `<p>Hello <strong>${rbtProfile.firstName}</strong>,</p><p>This is a friendly reminder that your interview with Rise and Shine is scheduled to begin in 30 minutes.</p>`}

          <div class="info-row">
            <span class="info-label">Date & Time:</span>
            <strong>${formattedDate}</strong>
          </div>
          <div class="info-row">
            <span class="info-label">Duration:</span>
            <strong>${interview.durationMinutes} minutes</strong>
          </div>
          ${isForAdmin ? `<div class="info-row"><span class="info-label">Candidate:</span><strong>${rbtProfile.firstName} ${rbtProfile.lastName}</strong></div>` : `<div class="info-row"><span class="info-label">Interviewer:</span><strong>${interview.interviewerName}</strong></div>`}

          ${interview.meetingUrl ? `
            <div style="text-align: center; margin: 24px 0;">
              <a href="${interview.meetingUrl}" class="cta-button">Join Meeting</a>
            </div>
          ` : ''}

          <p style="margin-top: 32px;">Best regards,<br><strong>The Rise and Shine Team</strong></p>
          <p style="margin-top: 24px; padding-top: 24px; border-top: 1px solid #eee; color: #666; font-size: 14px;">
            If you have any questions, reach out to <a href="mailto:info@riseandshine.nyc" style="color: #E4893D; text-decoration: none;">info@riseandshine.nyc</a>
          </p>
        </div>
        <div class="footer">
          <p><strong>Rise and Shine</strong> - HRM Portal</p>
          <p style="margin: 4px 0 0 0; font-size: 11px;">This is an automated reminder email.</p>
        </div>
      </div>
    </body>
    </html>
  `
  return { subject, html }
}

/**
 * 15-minute admin reminder email (Aaron + Kazi). Subject: "Interview in 15 minutes: {Candidate Name}"
 */
export function generateInterviewReminder15mEmail(
  candidateName: string,
  scheduledAt: Date,
  interviewLink: string,
  interviewerName?: string
): { subject: string; html: string } {
  const formattedTime = scheduledAt.toLocaleString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    timeZone: 'America/New_York',
    timeZoneName: 'short',
  })

  const subject = `Interview in 15 minutes: ${candidateName}`

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; }
        .container { max-width: 600px; margin: 0 auto; padding: 0; }
        .header { background: linear-gradient(135deg, #E4893D 0%, #FF9F5A 100%); color: white; padding: 32px 20px; text-align: center; border-radius: 12px 12px 0 0; }
        .header h1 { margin: 0; font-size: 22px; font-weight: bold; }
        .content { padding: 24px 20px; background-color: #ffffff; }
        .content p { margin: 12px 0; }
        .info-box { background-color: #FFF5F0; border-left: 4px solid #E4893D; padding: 16px; margin: 20px 0; border-radius: 4px; }
        .cta-button { display: inline-block; background: linear-gradient(135deg, #E4893D 0%, #FF9F5A 100%); color: white !important; padding: 14px 28px; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 14px; margin: 16px 0; }
        .footer { padding: 20px; text-align: center; font-size: 12px; color: #666; background-color: #f9f9f9; border-radius: 0 0 12px 12px; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>Interview in 15 minutes</h1>
        </div>
        <div class="content">
          <div class="info-box">
            <p style="margin: 0 0 8px 0;"><strong>Candidate:</strong> ${candidateName}</p>
            <p style="margin: 0 0 8px 0;"><strong>Time:</strong> ${formattedTime}</p>
            ${interviewerName ? `<p style="margin: 0;"><strong>Interviewer:</strong> ${interviewerName}</p>` : ''}
          </div>
          <p>Please open the interview notes page and complete the scorecard.</p>
          <p><a href="${interviewLink}" class="cta-button">Open interview notes</a></p>
          <p style="margin-top: 24px; font-size: 14px; color: #666;">Best regards,<br><strong>Rise and Shine HRM</strong></p>
        </div>
        <div class="footer">
          <p><strong>Rise and Shine</strong> - HRM Portal</p>
        </div>
      </div>
    </body>
    </html>
  `
  return { subject, html }
}

export function generateInterviewScheduledAdminEmail(
  candidateName: string,
  scheduledAt: Date,
  meetingUrl: string | null,
  interviewLink: string,
  claimLink: string
): { subject: string; html: string } {
  const formattedTime = scheduledAt.toLocaleString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    timeZone: 'America/New_York',
    timeZoneName: 'short',
  })

  const subject = `New Interview Scheduled: ${candidateName}`
  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; }
        .container { max-width: 600px; margin: 0 auto; padding: 0; }
        .header { background: linear-gradient(135deg, #E4893D 0%, #FF9F5A 100%); color: white; padding: 32px 20px; text-align: center; border-radius: 12px 12px 0 0; }
        .header h1 { margin: 0; font-size: 24px; font-weight: bold; }
        .content { padding: 24px 20px; background-color: #ffffff; }
        .content p { margin: 12px 0; }
        .info-box { background-color: #FFF5F0; border-left: 4px solid #E4893D; padding: 16px; margin: 20px 0; border-radius: 4px; }
        .cta-button { display: inline-block; background: linear-gradient(135deg, #E4893D 0%, #FF9F5A 100%); color: white !important; padding: 14px 28px; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 14px; margin: 8px 4px; }
        .claim-button { display: inline-block; background: linear-gradient(135deg, #16a34a 0%, #22c55e 100%); color: white !important; padding: 14px 28px; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 14px; margin: 8px 4px; }
        .footer { padding: 20px; text-align: center; font-size: 12px; color: #666; background-color: #f9f9f9; border-radius: 0 0 12px 12px; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>New Interview Scheduled</h1>
        </div>
        <div class="content">
          <p>A new interview has been scheduled and needs to be claimed by an admin.</p>
          <div class="info-box">
            <p style="margin: 0 0 8px 0;"><strong>Candidate:</strong> ${candidateName}</p>
            <p style="margin: 0 0 8px 0;"><strong>Scheduled:</strong> ${formattedTime}</p>
            ${meetingUrl ? `<p style="margin: 0;"><strong>Meeting:</strong> <a href="${meetingUrl}" style="color: #E4893D;">${meetingUrl}</a></p>` : ''}
          </div>
          <div style="text-align: center; margin: 24px 0;">
            <a href="${claimLink}" class="claim-button">Claim This Interview</a>
            <a href="${interviewLink}" class="cta-button">View Interview</a>
          </div>
          <p style="font-size: 14px; color: #666;">Please claim this interview if you plan to conduct it. Unclaimed interviews will appear as urgent reminders.</p>
          <p style="margin-top: 20px; font-size: 14px; color: #666;">Best regards,<br><strong>Rise and Shine HRM</strong></p>
        </div>
        <div class="footer">
          <p><strong>Rise and Shine</strong> - HRM Portal</p>
        </div>
      </div>
    </body>
    </html>
  `
  return { subject, html }
}

export function generateInterviewBookedForInterviewerEmail(
  rbtProfile: {
    id?: string
    firstName: string
    lastName: string
    phoneNumber: string | null
    email: string | null
  },
  interview: {
    scheduledAt: Date
    durationMinutes: number
    meetingUrl: string | null
  },
  links: {
    rbtProfileLink: string
  }
): { subject: string; html: string } {
  const formattedTime = interview.scheduledAt.toLocaleString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    timeZone: 'America/New_York',
    timeZoneName: 'short',
  })

  const candidateFullName = `${rbtProfile.firstName} ${rbtProfile.lastName}`
  const subject = `📅 New Interview Booked — ${candidateFullName}`

  const googleLocation = interview.meetingUrl || 'Video call'

  const html = `
  <!DOCTYPE html>
  <html>
  <head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <style>
      body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; }
      .container { max-width: 600px; margin: 0 auto; padding: 0; }
      .header { background: linear-gradient(135deg, #E4893D 0%, #FF9F5A 100%); color: white; padding: 32px 20px; text-align: center; border-radius: 12px 12px 0 0; }
      .header h1 { margin: 0; font-size: 24px; font-weight: bold; }
      .content { padding: 24px 20px; background-color: #ffffff; }
      .content p { margin: 12px 0; }
      .info-box { background-color: #FFF5F0; border-left: 4px solid #E4893D; padding: 16px; margin: 20px 0; border-radius: 4px; }
      .cta-button { display: inline-block; background: linear-gradient(135deg, #E4893D 0%, #FF9F5A 100%); color: white !important; padding: 14px 28px; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 14px; margin: 10px 4px; }
      .footer { padding: 20px; text-align: center; font-size: 12px; color: #666; background-color: #f9f9f9; border-radius: 0 0 12px 12px; }
      .meta { color: #555; font-size: 14px; }
    </style>
  </head>
  <body>
    <div class="container">
      <div class="header">
        <h1>New Interview Booked</h1>
      </div>
      <div class="content">
        <p>Hi there,</p>
        <p>A new interview has been scheduled for <strong>${candidateFullName}</strong>.</p>
        
        <div class="info-box">
          <p style="margin: 0 0 8px 0;"><strong>Date &amp; time:</strong> ${formattedTime}</p>
          <p style="margin: 0 0 8px 0;"><strong>Duration:</strong> ${interview.durationMinutes} minutes</p>
          <p style="margin: 0 0 8px 0;"><strong>Meeting:</strong> ${interview.meetingUrl ? `<a href="${interview.meetingUrl}" style="color: #E4893D;">${googleLocation}</a>` : googleLocation}</p>
        </div>
        
        ${interview.meetingUrl ? `<div style="text-align:center; margin: 24px 0;">
          <a href="${interview.meetingUrl}" class="cta-button">Open Meeting</a>
        </div>` : ''}

        <p class="meta">RBT contact:</p>
        <p class="meta">
          ${rbtProfile.email ? `Email: <a href="mailto:${rbtProfile.email}" style="color:#E4893D;">${rbtProfile.email}</a><br/>` : ''}
          ${rbtProfile.phoneNumber ? `Phone: ${rbtProfile.phoneNumber}<br/>` : ''}
        </p>
        
        <div style="text-align:center; margin-top: 18px;">
          <p style="margin: 0 0 10px 0;"><strong>Open candidate profile:</strong></p>
          <a href="${links.rbtProfileLink}" class="cta-button" style="background: linear-gradient(135deg, #111827 0%, #374151 100%);">View RBT</a>
        </div>

        <p style="margin-top: 24px; font-size: 14px; color: #666;">Best regards,<br><strong>Rise and Shine HRM</strong></p>
      </div>
      <div class="footer">
        <p><strong>Rise and Shine</strong> - HRM Portal</p>
      </div>
    </div>
  </body>
  </html>
  `

  return { subject, html }
}

export function generateInterviewReminder1hrEmail(
  candidateName: string,
  scheduledAt: Date,
  meetingUrl: string | null,
  interviewLink: string
): { subject: string; html: string } {
  const formattedTime = scheduledAt.toLocaleString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    timeZone: 'America/New_York',
    timeZoneName: 'short',
  })

  const subject = `Interview in 1 Hour: ${candidateName}`
  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; }
        .container { max-width: 600px; margin: 0 auto; padding: 0; }
        .header { background: linear-gradient(135deg, #dc2626 0%, #ef4444 100%); color: white; padding: 32px 20px; text-align: center; border-radius: 12px 12px 0 0; }
        .header h1 { margin: 0; font-size: 22px; font-weight: bold; }
        .content { padding: 24px 20px; background-color: #ffffff; }
        .content p { margin: 12px 0; }
        .info-box { background-color: #FEF2F2; border-left: 4px solid #dc2626; padding: 16px; margin: 20px 0; border-radius: 4px; }
        .cta-button { display: inline-block; background: linear-gradient(135deg, #dc2626 0%, #ef4444 100%); color: white !important; padding: 14px 28px; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 14px; margin: 16px 0; }
        .footer { padding: 20px; text-align: center; font-size: 12px; color: #666; background-color: #f9f9f9; border-radius: 0 0 12px 12px; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>Interview in 1 Hour</h1>
        </div>
        <div class="content">
          <p><strong>An interview is starting in approximately 1 hour.</strong></p>
          <div class="info-box">
            <p style="margin: 0 0 8px 0;"><strong>Candidate:</strong> ${candidateName}</p>
            <p style="margin: 0 0 8px 0;"><strong>Time:</strong> ${formattedTime}</p>
            ${meetingUrl ? `<p style="margin: 0;"><strong>Meeting:</strong> <a href="${meetingUrl}" style="color: #dc2626;">${meetingUrl}</a></p>` : ''}
          </div>
          <p>Please prepare your interview notes and scorecard. Make sure you've claimed the interview if you plan to conduct it.</p>
          <div style="text-align: center; margin: 24px 0;">
            <a href="${interviewLink}" class="cta-button">Open Interview</a>
          </div>
          <p style="margin-top: 20px; font-size: 14px; color: #666;">Best regards,<br><strong>Rise and Shine HRM</strong></p>
        </div>
        <div class="footer">
          <p><strong>Rise and Shine</strong> - HRM Portal</p>
        </div>
      </div>
    </body>
    </html>
  `
  return { subject, html }
}

export function generateInterviewClaimedEmail(
  claimerName: string,
  candidateName: string,
  scheduledAt: Date,
  isForClaimer: boolean
): { subject: string; html: string } {
  const formattedTime = scheduledAt.toLocaleString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    timeZone: 'America/New_York',
    timeZoneName: 'short',
  })

  const subject = isForClaimer
    ? `Interview Claimed: ${candidateName} - ${formattedTime}`
    : `Interview Claimed by ${claimerName}: ${candidateName}`
  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; }
        .container { max-width: 600px; margin: 0 auto; padding: 0; }
        .header { background: linear-gradient(135deg, #16a34a 0%, #22c55e 100%); color: white; padding: 32px 20px; text-align: center; border-radius: 12px 12px 0 0; }
        .header h1 { margin: 0; font-size: 22px; font-weight: bold; }
        .content { padding: 24px 20px; background-color: #ffffff; }
        .content p { margin: 12px 0; }
        .info-box { background-color: #F0FDF4; border-left: 4px solid #16a34a; padding: 16px; margin: 20px 0; border-radius: 4px; }
        .footer { padding: 20px; text-align: center; font-size: 12px; color: #666; background-color: #f9f9f9; border-radius: 0 0 12px 12px; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>Interview Claimed</h1>
        </div>
        <div class="content">
          ${isForClaimer
            ? `<p>You have successfully claimed the following interview:</p>`
            : `<p><strong>${claimerName}</strong> has claimed the following interview:</p>`
          }
          <div class="info-box">
            <p style="margin: 0 0 8px 0;"><strong>Candidate:</strong> ${candidateName}</p>
            <p style="margin: 0 0 8px 0;"><strong>Scheduled:</strong> ${formattedTime}</p>
            <p style="margin: 0;"><strong>Claimed by:</strong> ${claimerName}</p>
          </div>
          ${isForClaimer
            ? `<p>You are now the assigned interviewer. Please prepare and be ready to join the meeting on time.</p>`
            : `<p>This interview has been claimed and no further action is needed from you.</p>`
          }
          <p style="margin-top: 20px; font-size: 14px; color: #666;">Best regards,<br><strong>Rise and Shine HRM</strong></p>
        </div>
        <div class="footer">
          <p><strong>Rise and Shine</strong> - HRM Portal</p>
        </div>
      </div>
    </body>
    </html>
  `
  return { subject, html }
}

export function generateNewMessageFromAdminEmail(firstName: string, portalUrl: string): { subject: string; html: string } {
  const subject = 'You have a new message from Rise and Shine'
  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; background-color: #f5f5f5; }
        .container { max-width: 600px; margin: 0 auto; padding: 0; }
        .header { background: linear-gradient(135deg, #E4893D 0%, #FF9F5A 100%); color: white; padding: 40px 20px; text-align: center; border-radius: 12px 12px 0 0; }
        .header h1 { margin: 0; font-size: 28px; font-weight: bold; }
        .content { padding: 30px 20px; background-color: #ffffff; }
        .content p { margin: 16px 0; }
        .cta-button { display: inline-block; padding: 12px 24px; background: #E4893D; color: white; text-decoration: none; border-radius: 8px; font-weight: 600; margin: 16px 0; }
        .footer { padding: 24px 20px; text-align: center; font-size: 12px; color: #666; background-color: #f9f9f9; border-radius: 0 0 12px 12px; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>Rise and Shine</h1>
          <p style="margin: 8px 0 0 0; font-size: 16px; opacity: 0.95;">HRM Portal</p>
        </div>
        <div class="content">
          <p>Hi <strong>${firstName}</strong>,</p>
          <p>You have a new message from Rise and Shine. Log in to the portal to view your reply.</p>
          <p><a href="${portalUrl}" class="cta-button">View message</a></p>
          <p style="margin-top: 24px; font-size: 14px; color: #666;">Best regards,<br><strong>The Rise and Shine Team</strong></p>
        </div>
        <div class="footer">
          <p><strong>Rise and Shine</strong> - HRM Portal</p>
        </div>
      </div>
    </body>
    </html>
  `
  return { subject, html }
}

export function generateDocumentSignedReceiptEmail(params: {
  documentTitle: string
  signerName: string
  signedAtUtc: Date
}): string {
  const eastern = params.signedAtUtc.toLocaleString('en-US', {
    timeZone: 'America/New_York',
    dateStyle: 'full',
    timeStyle: 'short',
  })
  const documentTitle = params.documentTitle.replace(/</g, '&lt;').replace(/>/g, '&gt;')
  const signerName = params.signerName.replace(/</g, '&lt;').replace(/>/g, '&gt;')
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; background-color: #f5f5f5; }
        .container { max-width: 600px; margin: 0 auto; padding: 0; }
        .header { background: linear-gradient(135deg, #E4893D 0%, #e36f1e 100%); color: white; padding: 40px 20px; text-align: center; border-radius: 12px 12px 0 0; }
        .header h1 { margin: 0; font-size: 28px; font-weight: bold; }
        .content { padding: 30px 20px; background-color: #ffffff; }
        .content p { margin: 16px 0; }
        .footer { padding: 24px 20px; text-align: center; font-size: 12px; color: #666; background-color: #f9f9f9; border-radius: 0 0 12px 12px; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>Rise and Shine</h1>
          <p style="margin: 8px 0 0 0; font-size: 16px; opacity: 0.95;">HRM Portal</p>
        </div>
        <div class="content">
          <p>You have successfully signed <strong>${documentTitle}</strong>.</p>
          <p><strong>Signed as:</strong> ${signerName}</p>
          <p><strong>Date and time (Eastern):</strong> ${eastern}</p>
          <p><strong>Document:</strong> ${documentTitle}</p>
          <p>This email serves as your receipt of electronic signature. Please keep it for your records.</p>
          <p style="color: #b45309; font-size: 14px;">If you did not sign this document, please contact us immediately at <a href="mailto:info@riseandshine.nyc" style="color: #e36f1e;">info@riseandshine.nyc</a>.</p>
          <p style="margin-top: 24px;">Best regards,<br><strong>Rise and Shine</strong></p>
        </div>
        <div class="footer">
          <p><strong>Rise and Shine</strong> · <a href="mailto:info@riseandshine.nyc" style="color: #e36f1e;">info@riseandshine.nyc</a></p>
        </div>
      </div>
    </body>
    </html>
  `
}
