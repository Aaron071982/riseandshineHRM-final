import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { cookies } from 'next/headers'
import { validateSession } from '@/lib/auth'
import archiver from 'archiver'

interface UploadedFile {
  name: string
  mimeType: string
  data: string // base64
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const cookieStore = await cookies()
    const sessionToken = cookieStore.get('session')?.value

    if (!sessionToken) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const user = await validateSession(sessionToken)
    if (!user || user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // Find the RBT profile
    const rbtProfile = await prisma.rBTProfile.findUnique({
      where: { id },
      include: {
        onboardingTasks: {
          where: {
            taskType: 'PACKAGE_UPLOAD',
            isCompleted: true,
          },
        },
      },
    })

    if (!rbtProfile) {
      return NextResponse.json({ error: 'RBT profile not found' }, { status: 404 })
    }

    const packageTask = rbtProfile.onboardingTasks.find(
      (task) => task.taskType === 'PACKAGE_UPLOAD' && task.isCompleted && task.uploadUrl
    )

    if (!packageTask || !packageTask.uploadUrl) {
      return NextResponse.json(
        { error: 'No onboarding package uploaded yet' },
        { status: 404 }
      )
    }

    let uploadedFiles: UploadedFile[] = []

    // Check if uploadUrl is JSON (new format with multiple files)
    try {
      const parsed = JSON.parse(packageTask.uploadUrl)
      if (parsed.files && Array.isArray(parsed.files)) {
        uploadedFiles = parsed.files
      }
    } catch {
      // Not JSON, check if it's a data URL (old single file format)
      if (packageTask.uploadUrl.startsWith('data:')) {
        const matches = packageTask.uploadUrl.match(/^data:([^;]+);base64,(.+)$/)
        if (matches) {
          const mimeType = matches[1]
          const base64Data = matches[2]
          uploadedFiles = [
            {
              name: 'onboarding-package.pdf',
              mimeType,
              data: base64Data,
            },
          ]
        }
      }
    }

    if (uploadedFiles.length === 0) {
      return NextResponse.json(
        { error: 'No files found in uploaded package' },
        { status: 404 }
      )
    }

    // Create zip archive with all files
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

    // Wait for all data to be collected before finalizing
    const zipBuffer = await new Promise<Buffer>((resolve, reject) => {
      archive.on('end', () => {
        resolve(Buffer.concat(chunks))
      })
      archive.on('error', reject)
      
      // Finalize after setting up event handlers
      archive.finalize()
    })

    const rbtName = `${rbtProfile.firstName}-${rbtProfile.lastName}`.replace(/\s+/g, '-')
    
    return new NextResponse(zipBuffer, {
      headers: {
        'Content-Type': 'application/zip',
        'Content-Disposition': `attachment; filename="onboarding-package-${rbtName}.zip"`,
        'Content-Length': zipBuffer.length.toString(),
      },
    })
  } catch (error: any) {
    console.error('Error downloading package:', error)
    return NextResponse.json(
      { error: 'Failed to download package' },
      { status: 500 }
    )
  }
}

