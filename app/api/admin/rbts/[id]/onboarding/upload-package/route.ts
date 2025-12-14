import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { cookies } from 'next/headers'
import { validateSession } from '@/lib/auth'
import archiver from 'archiver'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
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

    const { id } = await params

    // Verify RBT profile exists
    const rbtProfile = await prisma.rBTProfile.findUnique({
      where: { id },
    })

    if (!rbtProfile) {
      return NextResponse.json(
        { error: 'RBT profile not found' },
        { status: 404 }
      )
    }

    // Find the package upload task
    const packageTask = await prisma.onboardingTask.findFirst({
      where: {
        rbtProfileId: id,
        taskType: 'PACKAGE_UPLOAD',
      },
    })

    if (!packageTask) {
      return NextResponse.json(
        { error: 'Package upload task not found' },
        { status: 404 }
      )
    }

    const formData = await request.formData()
    const files: File[] = []
    
    // Collect all files from form data (accept both 'files' and 'file' keys)
    for (const [key, value] of formData.entries()) {
      if (value instanceof File && (key === 'files' || key === 'file')) {
        files.push(value)
      }
    }

    if (files.length === 0) {
      return NextResponse.json(
        { error: 'No files provided' },
        { status: 400 }
      )
    }

    // Create ZIP archive
    const archive = archiver('zip', { zlib: { level: 9 } })
    const chunks: Buffer[] = []
    
    archive.on('data', (chunk: Buffer) => {
      chunks.push(chunk)
    })

    // Add files to archive
    for (const file of files) {
      const buffer = Buffer.from(await file.arrayBuffer())
      archive.append(buffer, { name: file.name })
    }

    await archive.finalize()

    const zipBuffer = Buffer.concat(chunks)
    const zipBase64 = zipBuffer.toString('base64')
    const uploadUrl = `data:application/zip;base64,${zipBase64}`

    // Update the task with the uploaded package
    await prisma.onboardingTask.update({
      where: { id: packageTask.id },
      data: {
        uploadUrl,
        isCompleted: true,
        completedAt: new Date(),
      },
    })

    return NextResponse.json({
      success: true,
      message: `Successfully uploaded ${files.length} file(s) as onboarding package`,
    })
  } catch (error: any) {
    console.error('Error uploading onboarding package:', error)
    return NextResponse.json(
      { error: 'Failed to upload package' },
      { status: 500 }
    )
  }
}

