import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { cookies } from 'next/headers'
import { validateSession } from '@/lib/auth'
import { Resend } from 'resend'

const resendApiKey = process.env.RESEND_API_KEY
const emailFrom = process.env.EMAIL_FROM || 'noreply@riseandshinehrm.com'
const adminEmail = 'aaronsiam21@gmail.com'

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
    if (!user || user.role !== 'RBT' || !user.rbtProfileId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const task = await prisma.onboardingTask.findUnique({
      where: { id },
      include: { rbtProfile: true },
    })

    if (!task || task.rbtProfileId !== user.rbtProfileId) {
      return NextResponse.json({ error: 'Task not found' }, { status: 404 })
    }

    const formData = await request.formData()
    const file = formData.get('file') as File

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 })
    }

    // Validate file size (max 10MB)
    const maxFileSize = 10 * 1024 * 1024 // 10MB
    if (file.size > maxFileSize) {
      return NextResponse.json(
        { error: `File size exceeds maximum allowed size of 10MB. Your file is ${(file.size / 1024 / 1024).toFixed(2)} MB.` },
        { status: 400 }
      )
    }

    // Validate file type for certificate uploads
    if (task.taskType === 'FORTY_HOUR_COURSE_CERTIFICATE') {
      const allowedTypes = ['application/pdf', 'image/jpeg', 'image/jpg', 'image/png']
      if (!allowedTypes.includes(file.type)) {
        return NextResponse.json(
          { error: 'Invalid file type. Please upload a PDF, JPG, or PNG file.' },
          { status: 400 }
        )
      }
    }

    try {
      // Convert file to base64 for storage
      const fileBuffer = Buffer.from(await file.arrayBuffer())
      const fileBase64 = fileBuffer.toString('base64')
      const fileMimeType = file.type || 'application/octet-stream'
      
      // Store as data URL for easy retrieval
      const uploadUrl = `data:${fileMimeType};base64,${fileBase64}`

      await prisma.onboardingTask.update({
        where: { id },
        data: {
          uploadUrl,
          isCompleted: true,
          completedAt: new Date(),
        },
      })

      // If this is a certificate upload, email it to admin
      if (task.taskType === 'FORTY_HOUR_COURSE_CERTIFICATE') {
        try {
          const rbtName = task.rbtProfile ? `${task.rbtProfile.firstName} ${task.rbtProfile.lastName}` : 'Unknown RBT'
          const rbtEmail = task.rbtProfile?.email || 'Unknown email'

          const emailSubject = `40-Hour RBT Course Certificate Received from ${rbtName}`
          const emailHtml = `
            <!DOCTYPE html>
            <html>
            <head>
              <meta charset="UTF-8">
              <style>
                body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
                .container { max-width: 600px; margin: 0 auto; padding: 20px; }
                .header { background-color: #E4893D; color: white; padding: 20px; text-align: center; }
                .content { padding: 20px; background-color: #f9f9f9; }
                .info-box { background-color: white; padding: 15px; margin: 15px 0; border-left: 4px solid #E4893D; }
                .footer { padding: 20px; text-align: center; font-size: 12px; color: #666; }
              </style>
            </head>
            <body>
              <div class="container">
                <div class="header">
                  <h1>Rise and Shine HRM</h1>
                </div>
                <div class="content">
                  <p>Hello,</p>
                  <p>A 40-hour RBT course certificate has been uploaded for your review.</p>
                  
                  <div class="info-box">
                    <p><strong>RBT Name:</strong> ${rbtName}</p>
                    <p><strong>RBT Email:</strong> ${rbtEmail}</p>
                    <p><strong>File Name:</strong> ${file.name}</p>
                    <p><strong>File Size:</strong> ${(file.size / 1024).toFixed(2)} KB</p>
                    <p><strong>Submitted:</strong> ${new Date().toLocaleString()}</p>
                  </div>
                  
                  <p>The certificate is attached to this email for your review.</p>
                  
                  <p>Best regards,<br><strong>Rise and Shine HRM System</strong></p>
                </div>
                <div class="footer">
                  <p><strong>Rise and Shine</strong> - HRM Portal</p>
                  <p style="margin: 4px 0 0 0; font-size: 11px;">This is an automated email.</p>
                </div>
              </div>
            </body>
            </html>
          `

          if (resendApiKey) {
            const resend = new Resend(resendApiKey)
            
            await resend.emails.send({
              from: emailFrom,
              to: adminEmail,
              subject: emailSubject,
              html: emailHtml,
              attachments: [
                {
                  filename: file.name,
                  content: fileBase64,
                },
              ],
            })

            console.log(`✅ 40-hour course certificate email sent to ${adminEmail} for RBT ${rbtName}`)
          } else {
            console.log(`⚠️ [DEV MODE] Certificate email would be sent to ${adminEmail}`)
            console.log(`   RBT: ${rbtName} (${rbtEmail})`)
            console.log(`   File: ${file.name} (${(file.size / 1024).toFixed(2)} KB)`)
          }
        } catch (emailError: any) {
          console.error('Error sending certificate email:', emailError)
          // Don't fail the upload if email fails
        }
      }

      // If this is a package upload, email it to admin
      if (task.taskType === 'PACKAGE_UPLOAD') {
      try {

        const rbtName = task.rbtProfile ? `${task.rbtProfile.firstName} ${task.rbtProfile.lastName}` : 'Unknown RBT'
        const rbtEmail = task.rbtProfile?.email || 'Unknown email'

        const emailSubject = `Onboarding Package Received from ${rbtName}`
        const emailHtml = `
          <!DOCTYPE html>
          <html>
          <head>
            <meta charset="UTF-8">
            <style>
              body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
              .container { max-width: 600px; margin: 0 auto; padding: 20px; }
              .header { background-color: #E4893D; color: white; padding: 20px; text-align: center; }
              .content { padding: 20px; background-color: #f9f9f9; }
              .info-box { background-color: white; padding: 15px; margin: 15px 0; border-left: 4px solid #E4893D; }
              .footer { padding: 20px; text-align: center; font-size: 12px; color: #666; }
            </style>
          </head>
          <body>
            <div class="container">
              <div class="header">
                <h1>Rise and Shine HRM</h1>
              </div>
              <div class="content">
                <p>Hello,</p>
                <p>An onboarding package has been uploaded and submitted for your review.</p>
                
                <div class="info-box">
                  <p><strong>RBT Name:</strong> ${rbtName}</p>
                  <p><strong>RBT Email:</strong> ${rbtEmail}</p>
                  <p><strong>File Name:</strong> ${file.name}</p>
                  <p><strong>File Size:</strong> ${(file.size / 1024).toFixed(2)} KB</p>
                  <p><strong>Submitted:</strong> ${new Date().toLocaleString()}</p>
                </div>
                
                <p>The onboarding package is attached to this email for your review.</p>
                
                <p>Best regards,<br><strong>Rise and Shine HRM System</strong></p>
              </div>
              <div class="footer">
                <p><strong>Rise and Shine</strong> - HRM Portal</p>
                <p style="margin: 4px 0 0 0; font-size: 11px;">This is an automated email.</p>
              </div>
            </div>
          </body>
          </html>
        `

        if (resendApiKey) {
          const resend = new Resend(resendApiKey)
          
          await resend.emails.send({
            from: emailFrom,
            to: adminEmail,
            subject: emailSubject,
            html: emailHtml,
            attachments: [
              {
                filename: file.name,
                content: fileBase64,
              },
            ],
          })

          console.log(`✅ Onboarding package email sent to ${adminEmail} for RBT ${rbtName}`)
        } else {
          console.log(`⚠️ [DEV MODE] Package upload email would be sent to ${adminEmail}`)
          console.log(`   RBT: ${rbtName} (${rbtEmail})`)
          console.log(`   File: ${file.name} (${(file.size / 1024).toFixed(2)} KB)`)
        }
      } catch (emailError: any) {
        console.error('Error sending package upload email:', emailError)
        // Don't fail the upload if email fails
      }
    }

      return NextResponse.json({ success: true, uploadUrl })
    } catch (processError: any) {
      console.error('Error processing file:', processError)
      throw processError // Re-throw to be caught by outer catch
    }
  } catch (error: any) {
    console.error('Error uploading file:', error)
    
    // Provide more specific error messages
    if (error.message && error.message.includes('size')) {
      return NextResponse.json(
        { error: error.message },
        { status: 400 }
      )
    }
    
    if (error.message && error.message.includes('type')) {
      return NextResponse.json(
        { error: error.message },
        { status: 400 }
      )
    }
    
    return NextResponse.json(
      { error: error.message || 'Failed to upload file. Please check your connection and try again.' },
      { status: 500 }
    )
  }
}

