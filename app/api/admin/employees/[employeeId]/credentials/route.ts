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

    const creds = await prisma.credential.findMany({
      where: { employeeId },
      orderBy: { createdAt: 'desc' },
    })

    return NextResponse.json(creds)
  } catch (error) {
    console.error('[employees:credentials][GET] failed', error)
    return NextResponse.json({ error: 'Failed to fetch credentials' }, { status: 500 })
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
      credentialType,
      credentialNumber,
      state,
      issuedAt,
      expiresAt,
    } = body as {
      credentialType?: string
      credentialNumber?: string
      state?: string
      issuedAt?: string
      expiresAt?: string
    }

    if (!credentialType) {
      return NextResponse.json({ error: 'credentialType is required' }, { status: 400 })
    }
    if (!credentialNumber?.trim()) {
      return NextResponse.json({ error: 'credentialNumber is required' }, { status: 400 })
    }

    const created = await prisma.credential.create({
      data: {
        employeeId,
        credentialType: credentialType as any,
        credentialNumber: credentialNumber.trim(),
        state: state?.trim() || null,
        issuedAt: issuedAt ? new Date(issuedAt) : null,
        expiresAt: expiresAt ? new Date(expiresAt) : null,
      },
    })

    await writeAuditLog({
      actorUserId: user.id,
      entityType: 'Credential',
      entityId: created.id,
      action: 'CREATE',
      before: null,
      after: created,
    })

    return NextResponse.json(created, { status: 201 })
  } catch (error) {
    console.error('[employees:credentials][POST] failed', error)
    return NextResponse.json({ error: 'Failed to create credential' }, { status: 500 })
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

    const existing = await prisma.credential.findFirst({
      where: { id, employeeId },
    })
    if (!existing) {
      return NextResponse.json({ error: 'Credential not found' }, { status: 404 })
    }

    const body = await request.json()
    const updateData: any = {}
    if (body.verificationStatus)
      updateData.verificationStatus = body.verificationStatus as any
    if (body.verifiedAt !== undefined)
      updateData.verifiedAt = body.verifiedAt ? new Date(body.verifiedAt) : null
    if (body.expiresAt !== undefined)
      updateData.expiresAt = body.expiresAt ? new Date(body.expiresAt) : null

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json({ error: 'No fields to update' }, { status: 400 })
    }

    if (updateData.verificationStatus) {
      updateData.verifiedByUserId = user.id
    }

    const updated = await prisma.credential.update({
      where: { id: existing.id },
      data: updateData,
    })

    await writeAuditLog({
      actorUserId: user.id,
      entityType: 'Credential',
      entityId: updated.id,
      action: 'UPDATE',
      before: existing,
      after: updated,
    })

    return NextResponse.json(updated)
  } catch (error) {
    console.error('[employees:credentials][PATCH] failed', error)
    return NextResponse.json({ error: 'Failed to update credential' }, { status: 500 })
  }
}

