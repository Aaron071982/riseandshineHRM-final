import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { cookies } from 'next/headers'
import { validateSession } from '@/lib/auth'

// PATCH: Update RBT profile
export async function PATCH(
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

    const data = await request.json()

    // Validate required fields
    if (!data.addressLine1 || !data.zipCode) {
      return NextResponse.json(
        { error: 'Address Line 1 and Zip Code are required' },
        { status: 400 }
      )
    }

    // Update RBT profile
    const updatedProfile = await prisma.rBTProfile.update({
      where: { id },
      data: {
        firstName: data.firstName,
        lastName: data.lastName,
        phoneNumber: data.phoneNumber,
        email: data.email || null,
        locationCity: data.locationCity || null,
        locationState: data.locationState || null,
        zipCode: data.zipCode,
        addressLine1: data.addressLine1,
        addressLine2: data.addressLine2 || null,
        preferredServiceArea: data.preferredServiceArea || null,
        notes: data.notes || null,
        gender: data.gender || null,
        fortyHourCourseCompleted: data.fortyHourCourseCompleted ?? false,
      },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            role: true,
            isActive: true,
          },
        },
      },
    })

    // Also update user email and name if they changed
    if (data.email !== updatedProfile.email || 
        `${data.firstName} ${data.lastName}` !== `${updatedProfile.firstName} ${updatedProfile.lastName}`) {
      await prisma.user.update({
        where: { id: updatedProfile.userId },
        data: {
          email: data.email || null,
          name: `${data.firstName} ${data.lastName}`,
        },
      })
    }

    return NextResponse.json({ success: true, profile: updatedProfile })
  } catch (error: any) {
    console.error('Error updating RBT profile:', error)
    if (error.code === 'P2025') {
      return NextResponse.json({ error: 'RBT profile not found' }, { status: 404 })
    }
    return NextResponse.json(
      { error: 'Failed to update profile' },
      { status: 500 }
    )
  }
}

