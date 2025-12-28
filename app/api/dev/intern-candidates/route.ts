// DEV ONLY — NOT FOR PRODUCTION — NO DB
// Local JSON storage API for intern candidates

import { NextRequest, NextResponse } from 'next/server'
import {
  getAllCandidates,
  createCandidate,
  type InternCandidate,
} from '@/lib/intern-storage'

export async function GET() {
  try {
    const candidates = await getAllCandidates()
    return NextResponse.json(candidates)
  } catch (error) {
    console.error('Error fetching candidates:', error)
    return NextResponse.json(
      { error: 'Failed to fetch candidates' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { name, email, phone, role } = body

    if (!name || !email || !role) {
      return NextResponse.json(
        { error: 'Name, email, and role are required' },
        { status: 400 }
      )
    }

    const candidate = await createCandidate({
      name,
      email,
      phone: phone || undefined,
      role,
      status: 'Applied',
    })

    return NextResponse.json(candidate, { status: 201 })
  } catch (error) {
    console.error('Error creating candidate:', error)
    return NextResponse.json(
      { error: 'Failed to create candidate' },
      { status: 500 }
    )
  }
}


