import { NextRequest, NextResponse } from 'next/server'
import { requireBillingManagerSession } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function GET() {
  const auth = await requireBillingManagerSession()
  if (auth.response) return auth.response

  const [rbtMappings, payrollOnly] = await Promise.all([
    prisma.rBTProfile.findMany({
      where: {
        OR: [{ artemisProviderName: { not: null } }, { status: { in: ['HIRED', 'ONBOARDING_COMPLETED'] } }],
      },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        artemisProviderName: true,
        hourlyPayRate: true,
        email: true,
      },
      orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }],
    }),
    prisma.payrollOnlyPerson.findMany({
      orderBy: { fullName: 'asc' },
    }),
  ])

  return NextResponse.json({
    rbtMappings: rbtMappings.filter((r) => r.artemisProviderName),
    payrollOnly,
  })
}

export async function PATCH(request: NextRequest) {
  const auth = await requireBillingManagerSession()
  if (auth.response) return auth.response

  const body = await request.json()

  if (body.type === 'rbt' && body.id) {
    const artemisProviderName =
      body.artemisProviderName === '' || body.artemisProviderName == null
        ? null
        : String(body.artemisProviderName).trim()
    const updated = await prisma.rBTProfile.update({
      where: { id: body.id },
      data: { artemisProviderName },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        artemisProviderName: true,
        hourlyPayRate: true,
      },
    })
    return NextResponse.json({ mapping: updated })
  }

  if (body.type === 'payroll_only') {
    if (body.id) {
      const updated = await prisma.payrollOnlyPerson.update({
        where: { id: body.id },
        data: {
          ...(body.fullName != null ? { fullName: String(body.fullName).trim() } : {}),
          ...(body.artemisProviderName != null
            ? { artemisProviderName: String(body.artemisProviderName).trim() }
            : {}),
          ...(body.email !== undefined ? { email: body.email || null } : {}),
          ...(body.hourlyPayRate !== undefined
            ? { hourlyPayRate: body.hourlyPayRate == null ? null : Number(body.hourlyPayRate) }
            : {}),
        },
      })
      return NextResponse.json({ mapping: updated })
    }
    const created = await prisma.payrollOnlyPerson.create({
      data: {
        fullName: String(body.fullName ?? '').trim(),
        artemisProviderName: String(body.artemisProviderName ?? '').trim(),
        email: body.email || null,
        hourlyPayRate: body.hourlyPayRate != null ? Number(body.hourlyPayRate) : null,
      },
    })
    return NextResponse.json({ mapping: created })
  }

  if (body.type === 'payroll_only_delete' && body.id) {
    await prisma.payrollOnlyPerson.delete({ where: { id: body.id } })
    return NextResponse.json({ success: true })
  }

  return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
}
