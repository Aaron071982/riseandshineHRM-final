// DEV ONLY — NOT FOR PRODUCTION — NO DB
// Local JSON storage API for intern candidate operations

import { NextRequest, NextResponse } from 'next/server'
import {
  getCandidateById,
  updateCandidate,
  deleteCandidate,
} from '@/lib/intern-storage'

export async function GET(
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

    return NextResponse.json(candidate)
  } catch (error) {
    console.error('Error fetching candidate:', error)
    return NextResponse.json(
      { error: 'Failed to fetch candidate' },
      { status: 500 }
    )
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const body = await request.json()

    const updated = await updateCandidate(id, body)

    if (!updated) {
      return NextResponse.json(
        { error: 'Candidate not found' },
        { status: 404 }
      )
    }

    return NextResponse.json(updated)
  } catch (error) {
    console.error('Error updating candidate:', error)
    return NextResponse.json(
      { error: 'Failed to update candidate' },
      { status: 500 }
    )
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const deleted = await deleteCandidate(id)

    if (!deleted) {
      return NextResponse.json(
        { error: 'Candidate not found' },
        { status: 404 }
      )
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting candidate:', error)
    return NextResponse.json(
      { error: 'Failed to delete candidate' },
      { status: 500 }
    )
  }
}


