import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { prisma } from '@/lib/prisma'
import { validateSession, isAdmin } from '@/lib/auth'
import { writeAuditLog } from '@/lib/audit'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ employeeId: string }> },
) {
  try {
    const cookieStore = await cookies()
    const sessionToken = cookieStore.get('session')?.value
    if (!sessionToken) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const user = await validateSession(sessionToken)
    if (!isAdmin(user)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    const { employeeId } = await params

    const docs = await prisma.employmentDocument.findMany({
      where: { employeeId },
      orderBy: { createdAt: 'desc' },
    })

    return NextResponse.json(docs)
  } catch (error) {
    console.error('[employees:documents][GET] failed', error)
    return NextResponse.json({ error: 'Failed to fetch documents' }, { status: 500 })
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ employeeId: string }> },
) {
  try {
    const cookieStore = await cookies()
    const sessionToken = cookieStore.get('session')?.value
    if (!sessionToken) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const user = await validateSession(sessionToken)
    if (!isAdmin(user)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    const { employeeId } = await params
    const employee = await prisma.employee.findUnique({ where: { id: employeeId } })
    if (!employee) {
      return NextResponse.json({ error: 'Employee not found' }, { status: 404 })
    }

    const body = await request.json()
    const {
      docType,
      fileUrl,
      fileHash,
      issuedAt,
      expiresAt,
      notes,
    } = body as {
      docType?: string
      fileUrl?: string
      fileHash?: string
      issuedAt?: string
      expiresAt?: string
      notes?: string
    }

    if (!docType) {
      return NextResponse.json({ error: 'docType is required' }, { status: 400 })
    }

    const created = await prisma.employmentDocument.create({
      data: {
        employeeId,
        docType: docType as any,
        fileUrl: fileUrl?.trim() || null,
        fileHash: fileHash?.trim() || null,
        issuedAt: issuedAt ? new Date(issuedAt) : null,
        expiresAt: expiresAt ? new Date(expiresAt) : null,
        notes: notes?.trim() || null,
        createdByUserId: user.id,
      },
    })

    await writeAuditLog({
      actorUserId: user.id,
      entityType: 'EmploymentDocument',
      entityId: created.id,
      action: 'CREATE',
      before: null,
      after: created,
    })

    return NextResponse.json(created, { status: 201 })
  } catch (error) {
    console.error('[employees:documents][POST] failed', error)
    return NextResponse.json({ error: 'Failed to create document' }, { status: 500 })
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ employeeId: string }> },
) {
  try {
    const cookieStore = await cookies()
    const sessionToken = cookieStore.get('session')?.value
    if (!sessionToken) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const user = await validateSession(sessionToken)
    if (!isAdmin(user)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    const { employeeId } = await params
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')
    if (!id) return NextResponse.json({ error: 'id is required' }, { status: 400 })

    const existing = await prisma.employmentDocument.findFirst({
      where: { id, employeeId },
    })
    if (!existing) {
      return NextResponse.json({ error: 'Document not found' }, { status: 404 })
    }

    const body = await request.json()
    const updateData: any = {}
    if (body.status) updateData.status = body.status
    if (body.expiresAt !== undefined)
      updateData.expiresAt = body.expiresAt ? new Date(body.expiresAt) : null
    if (body.notes !== undefined) updateData.notes = body.notes?.trim() || null

    const updated = await prisma.employmentDocument.update({
      where: { id: existing.id },
      data: updateData,
    })

    await writeAuditLog({
      actorUserId: user.id,
      entityType: 'EmploymentDocument',
      entityId: updated.id,
      action: 'UPDATE',
      before: existing,
      after: updated,
    })

    return NextResponse.json(updated)
  } catch (error) {
    console.error('[employees:documents][PATCH] failed', error)
    return NextResponse.json({ error: 'Failed to update document' }, { status: 500 })
  }
}

