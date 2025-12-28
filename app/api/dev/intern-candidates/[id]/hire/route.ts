// DEV ONLY — NOT FOR PRODUCTION — NO DB
// Hire an intern candidate (move to interns list)

import { NextRequest, NextResponse } from 'next/server'
import {
  getCandidateById,
  updateCandidate,
  createIntern,
} from '@/lib/intern-storage'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const candidate = await getCandidateById(id)

    if (!candidate) {
      return NextResponse.json(
        { error: 'Candidate not found' },
        { status: 404 }
      )
    }

    // Update candidate status to Hired
    await updateCandidate(id, { status: 'Hired' })

    // Create intern record
    const intern = await createIntern({
      name: candidate.name,
      email: candidate.email,
      phone: candidate.phone,
      role: candidate.role,
      candidateId: id,
      status: 'Active',
    })

    return NextResponse.json({ intern, candidate }, { status: 201 })
  } catch (error) {
    console.error('Error hiring candidate:', error)
    return NextResponse.json(
      { error: 'Failed to hire candidate' },
      { status: 500 }
    )
  }
}


