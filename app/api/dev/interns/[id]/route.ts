// DEV ONLY — NOT FOR PRODUCTION — NO DB
// Local JSON storage API for intern operations

import { NextRequest, NextResponse } from 'next/server'
import {
  getInternById,
  updateIntern,
  deleteIntern,
} from '@/lib/intern-storage'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const intern = await getInternById(id)

    if (!intern) {
      return NextResponse.json(
        { error: 'Intern not found' },
        { status: 404 }
      )
    }

    return NextResponse.json(intern)
  } catch (error) {
    console.error('Error fetching intern:', error)
    return NextResponse.json(
      { error: 'Failed to fetch intern' },
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

    const updated = await updateIntern(id, body)

    if (!updated) {
      return NextResponse.json(
        { error: 'Intern not found' },
        { status: 404 }
      )
    }

    return NextResponse.json(updated)
  } catch (error) {
    console.error('Error updating intern:', error)
    return NextResponse.json(
      { error: 'Failed to update intern' },
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
    const deleted = await deleteIntern(id)

    if (!deleted) {
      return NextResponse.json(
        { error: 'Intern not found' },
        { status: 404 }
      )
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting intern:', error)
    return NextResponse.json(
      { error: 'Failed to delete intern' },
      { status: 500 }
    )
  }
}


