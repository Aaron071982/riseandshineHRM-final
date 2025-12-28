// DEV ONLY — NOT FOR PRODUCTION — NO DB
// Local JSON storage API for interns

import { NextRequest, NextResponse } from 'next/server'
import {
  getAllInterns,
  createIntern,
} from '@/lib/intern-storage'

export async function GET() {
  try {
    const interns = await getAllInterns()
    return NextResponse.json(interns)
  } catch (error) {
    console.error('Error fetching interns:', error)
    return NextResponse.json(
      { error: 'Failed to fetch interns' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { name, email, phone, role, candidateId, expectedHoursPerWeek, status } = body

    if (!name || !email || !role) {
      return NextResponse.json(
        { error: 'Name, email, and role are required' },
        { status: 400 }
      )
    }

    const intern = await createIntern({
      name,
      email,
      phone: phone || undefined,
      role,
      candidateId: candidateId || undefined,
      expectedHoursPerWeek: expectedHoursPerWeek ? Number(expectedHoursPerWeek) : undefined,
      status: status || 'Active',
    })

    return NextResponse.json(intern, { status: 201 })
  } catch (error) {
    console.error('Error creating intern:', error)
    return NextResponse.json(
      { error: 'Failed to create intern' },
      { status: 500 }
    )
  }
}


