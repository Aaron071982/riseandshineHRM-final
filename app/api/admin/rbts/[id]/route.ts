import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAdminSession } from '@/lib/auth'
import { geocodeAddress } from '@/lib/mapbox-geocode'

// PATCH: Update RBT profile
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireAdminSession()
    if (auth.response) return auth.response
    const { id } = await params
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
        ethnicity: data.ethnicity || null,
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

    // Auto-geocode address (fire-and-forget)
    const addr = {
      addressLine1: data.addressLine1,
      city: data.locationCity,
      state: data.locationState,
      zip: data.zipCode,
    }
    if (addr.addressLine1 || addr.city || addr.state) {
      geocodeAddress(addr.addressLine1, addr.city, addr.state, addr.zip).then((result) => {
        if (result) {
          prisma.rBTProfile.update({
            where: { id },
            data: { latitude: result.lat, longitude: result.lng },
          }).catch((e) => console.error('[PATCH rbts] geocode update', e))
        }
      }).catch((e) => console.error('[PATCH rbts] geocode', e))
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

