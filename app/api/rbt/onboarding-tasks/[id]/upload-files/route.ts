import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { cookies } from 'next/headers'
import { validateSession } from '@/lib/auth'
import { Resend } from 'resend'
import archiver from 'archiver'

const resendApiKey = process.env.RESEND_API_KEY
const emailFrom = process.env.EMAIL_FROM || 'noreply@riseandshinehrm.com'
const adminEmail = 'aaronsiam21@gmail.com'

interface UploadedFile {
  name: string
  mimeType: string
  data: string // base64
}

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
    const files: File[] = []
    
    // Collect all files from form data
    for (const [key, value] of formData.entries()) {
      if (value instanceof File) {
        files.push(value)
      }
    }

    if (files.length === 0) {
      return NextResponse.json({ error: 'No files provided' }, { status: 400 })
    }

    // Convert all files to base64 and store them
    const uploadedFiles: UploadedFile[] = []
    for (const file of files) {
      const fileBuffer = Buffer.from(await file.arrayBuffer())
      const fileBase64 = fileBuffer.toString('base64')
      uploadedFiles.push({
        name: file.name,
        mimeType: file.type || 'application/octet-stream',
        data: fileBase64,
      })
    }

    // Store as JSON in uploadUrl
    const uploadUrl = JSON.stringify({
      files: uploadedFiles,
      uploadedAt: new Date().toISOString(),
    })

    await prisma.onboardingTask.update({
      where: { id },
      data: {
        uploadUrl,
        isCompleted: true,
        completedAt: new Date(),
      },
    })

    // If this is a package upload, email all files as a zip to admin
    if (task.taskType === 'PACKAGE_UPLOAD') {
      try {
        // Create zip archive of all uploaded files
        const archive = archiver('zip', { zlib: { level: 9 } })
        const chunks: Buffer[] = []

        archive.on('data', (chunk: Buffer) => {
          chunks.push(chunk)
        })

        // Add all files to archive
        for (const file of uploadedFiles) {
          const fileBuffer = Buffer.from(file.data, 'base64')
          archive.append(fileBuffer, { name: file.name })
        }

        await archive.finalize()

        const zipBuffer = await new Promise<Buffer>((resolve, reject) => {
          archive.on('end', () => {
            resolve(Buffer.concat(chunks))
          })
          archive.on('error', reject)
        })

        const rbtName = task.rbtProfile
          ? `${task.rbtProfile.firstName} ${task.rbtProfile.lastName}`
          : 'Unknown RBT'
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
              .file-list { background-color: white; padding: 15px; margin: 15px 0; border-left: 4px solid #E4893D; }
              .file-list ul { margin: 10px 0; padding-left: 20px; }
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
                  <p><strong>Number of Files:</strong> ${files.length}</p>
                  <p><strong>Submitted:</strong> ${new Date().toLocaleString()}</p>
                </div>
                
                <div class="file-list">
                  <p><strong>Uploaded Files:</strong></p>
                  <ul>
                    ${files.map((f) => `<li>${f.name} (${(f.size / 1024).toFixed(2)} KB)</li>`).join('')}
                  </ul>
                </div>
                
                <p>All files are attached as a ZIP archive in this email. You can also download them from the admin dashboard.</p>
                
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
                filename: `onboarding-package-${rbtName.replace(/\s+/g, '-')}.zip`,
                content: zipBuffer,
              },
            ],
          })
        }
      } catch (emailError: any) {
        console.error('Error sending email:', emailError)
        // Don't fail the upload if email fails
      }
    }

    return NextResponse.json({
      success: true,
      message: `Successfully uploaded ${files.length} file(s)`,
      filesCount: files.length,
    })
  } catch (error: any) {
    console.error('Error uploading files:', error)
    return NextResponse.json(
      { error: 'Failed to upload files: ' + error.message },
      { status: 500 }
    )
  }
}

