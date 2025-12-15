import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { cookies } from 'next/headers'
import { validateSession } from '@/lib/auth'

export async function POST(request: NextRequest) {
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

    const formData = await request.formData()

    // Extract form fields
    const data = {
      firstName: formData.get('firstName') as string,
      lastName: formData.get('lastName') as string,
      phoneNumber: formData.get('phoneNumber') as string,
      email: (formData.get('email') as string) || null,
      locationCity: (formData.get('locationCity') as string) || null,
      locationState: (formData.get('locationState') as string) || null,
      zipCode: formData.get('zipCode') as string,
      addressLine1: formData.get('addressLine1') as string,
      addressLine2: (formData.get('addressLine2') as string) || null,
      preferredServiceArea: (formData.get('preferredServiceArea') as string) || null,
      notes: (formData.get('notes') as string) || null,
      gender: (formData.get('gender') as string) || null,
      fortyHourCourseCompleted: formData.get('fortyHourCourseCompleted') === 'true',
      status: (formData.get('status') as string) || 'NEW',
    }

    // Validate required fields
    if (!data.addressLine1 || !data.zipCode) {
      return NextResponse.json(
        { error: 'Address Line 1 and Zip Code are required' },
        { status: 400 }
      )
    }

    // Create user first
    const userRecord = await prisma.user.create({
      data: {
        phoneNumber: data.phoneNumber,
        email: data.email || null,
        name: `${data.firstName} ${data.lastName}`,
        role: data.status === 'HIRED' ? 'RBT' : 'CANDIDATE',
        isActive: true,
      },
    })

    // Create RBT profile
    const rbtProfile = await prisma.rBTProfile.create({
      data: {
        userId: userRecord.id,
        firstName: data.firstName,
        lastName: data.lastName,
        phoneNumber: data.phoneNumber,
        email: data.email || null,
        locationCity: data.locationCity || null,
        locationState: data.locationState || null,
        zipCode: data.zipCode || null,
        addressLine1: data.addressLine1 || null,
        addressLine2: data.addressLine2 || null,
        preferredServiceArea: data.preferredServiceArea || null,
        notes: data.notes || null,
        gender: data.gender || null,
        fortyHourCourseCompleted: data.fortyHourCourseCompleted,
        status: data.status as any,
      },
    })

    // Handle documents if provided
    const files = formData.getAll('documents') as File[]
    const documentTypes = formData.getAll('documentTypes') as string[]

    if (files.length > 0) {
      for (let i = 0; i < files.length; i++) {
        const file = files[i]
        const documentType = documentTypes[i] || 'OTHER'

        // Convert file to base64
        const fileBuffer = Buffer.from(await file.arrayBuffer())
        const fileBase64 = fileBuffer.toString('base64')
        const fileMimeType = file.type || 'application/octet-stream'

        await prisma.rBTDocument.create({
          data: {
            rbtProfileId: rbtProfile.id,
            fileName: file.name,
            fileType: fileMimeType,
            fileData: fileBase64,
            documentType: documentType,
          },
        })
      }
    }

    return NextResponse.json({ id: rbtProfile.id, success: true })
  } catch (error: any) {
    console.error('Error creating RBT:', error)
    if (error.code === 'P2002') {
      return NextResponse.json(
        { error: 'Phone number already exists' },
        { status: 400 }
      )
    }
    return NextResponse.json(
      { error: 'Failed to create candidate' },
      { status: 500 }
    )
  }
}

