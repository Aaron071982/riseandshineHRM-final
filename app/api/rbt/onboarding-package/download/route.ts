import { NextRequest, NextResponse } from 'next/server'
import { readdir, stat, readFile } from 'fs/promises'
import { join } from 'path'
import archiver from 'archiver'

export async function GET(request: NextRequest) {
  try {
    const onboardingFolderPath = join(process.cwd(), 'onboarding documents')
    
    // Check if folder exists
    try {
      await stat(onboardingFolderPath)
    } catch {
      return NextResponse.json(
        { error: 'Onboarding documents folder not found' },
        { status: 404 }
      )
    }

    // Get all files in the folder
    const files = await readdir(onboardingFolderPath)
    const validFiles = []
    
    // Check each file
    for (const file of files) {
      const filePath = join(onboardingFolderPath, file)
      const fileStat = await stat(filePath)
      if (fileStat.isFile()) {
        validFiles.push({ name: file, path: filePath })
      }
    }

    if (validFiles.length === 0) {
      return NextResponse.json(
        { error: 'No files found in onboarding documents folder' },
        { status: 404 }
      )
    }

    // Create a zip archive
    const archive = archiver('zip', {
      zlib: { level: 9 }
    })

    // Collect all data into a buffer
    const chunks: Buffer[] = []
    
    archive.on('data', (chunk: Buffer) => {
      chunks.push(chunk)
    })

    // Add all files to archive
    for (const file of validFiles) {
      const fileBuffer = await readFile(file.path)
      archive.append(fileBuffer, { name: file.name })
    }

    // Wait for all data to be collected before finalizing
    return new Promise<NextResponse>((resolve, reject) => {
      archive.on('end', () => {
        const buffer = Buffer.concat(chunks)
        // Convert Buffer to Uint8Array for NextResponse compatibility
        const uint8Array = new Uint8Array(buffer)
        resolve(
          new NextResponse(uint8Array, {
            headers: {
              'Content-Type': 'application/zip',
              'Content-Disposition': 'attachment; filename="onboarding-documents.zip"',
              'Content-Length': buffer.length.toString(),
            },
          })
        )
      })

      archive.on('error', (err) => {
        reject(err)
      })
      
      // Finalize after setting up event handlers
      archive.finalize()
    })
  } catch (error: any) {
    console.error('Error creating zip:', error)
    return NextResponse.json(
      { error: 'Failed to create onboarding package' },
      { status: 500 }
    )
  }
}

