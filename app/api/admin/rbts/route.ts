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

    const data = await request.json()

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
        status: data.status || 'NEW',
      },
    })

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

