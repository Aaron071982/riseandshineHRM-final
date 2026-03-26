import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAdminSession } from '@/lib/auth'
import { StaffHoursLogType } from '@prisma/client'

const VALID_TYPES = ['bcba', 'billing', 'marketing', 'call-center'] as const
type EmployeeTypeSlug = (typeof VALID_TYPES)[number]

const CONFIG: Record<
  EmployeeTypeSlug,
  {
    staffHoursLogType: StaffHoursLogType
    findUnique: (id: string) => Promise<{ id: string } | null>
    deleteProfile: (id: string) => Promise<unknown>
    notFoundMessage: string
    successMessage: string
  }
> = {
  bcba: {
    staffHoursLogType: 'BCBA',
    findUnique: (id) => prisma.bCBAProfile.findUnique({ where: { id }, select: { id: true } }),
    deleteProfile: (id) => prisma.bCBAProfile.delete({ where: { id } }),
    notFoundMessage: 'BCBA profile not found',
    successMessage: 'BCBA deleted successfully',
  },
  billing: {
    staffHoursLogType: 'BILLING',
    findUnique: (id) => prisma.billingProfile.findUnique({ where: { id }, select: { id: true } }),
    deleteProfile: (id) => prisma.billingProfile.delete({ where: { id } }),
    notFoundMessage: 'Billing profile not found',
    successMessage: 'Billing profile deleted successfully',
  },
  marketing: {
    staffHoursLogType: 'MARKETING',
    findUnique: (id) => prisma.marketingProfile.findUnique({ where: { id }, select: { id: true } }),
    deleteProfile: (id) => prisma.marketingProfile.delete({ where: { id } }),
    notFoundMessage: 'Marketing profile not found',
    successMessage: 'Marketing profile deleted successfully',
  },
  'call-center': {
    staffHoursLogType: 'CALL_CENTER',
    findUnique: (id) => prisma.callCenterProfile.findUnique({ where: { id }, select: { id: true } }),
    deleteProfile: (id) => prisma.callCenterProfile.delete({ where: { id } }),
    notFoundMessage: 'Call center profile not found',
    successMessage: 'Call center profile deleted successfully',
  },
}

/**
 * DELETE /api/admin/employees/[employeeId]/[id]/delete
 * For BCBA/Billing/Marketing/Call-center, employeeId is the type slug (bcba|billing|marketing|call-center) and id is the profile id.
 */
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ employeeId: string; id: string }> }
) {
  try {
    const auth = await requireAdminSession()
    if (auth.response) return auth.response
    const { employeeId, id } = await params

    const slug = employeeId.toLowerCase() as EmployeeTypeSlug
    if (!VALID_TYPES.includes(slug)) {
      return NextResponse.json(
        { error: `Invalid employee type. Must be one of: ${VALID_TYPES.join(', ')}` },
        { status: 400 }
      )
    }

    const config = CONFIG[slug]
    const profile = await config.findUnique(id)
    if (!profile) {
      return NextResponse.json({ error: config.notFoundMessage }, { status: 404 })
    }

    await prisma.staffHoursLog.deleteMany({
      where: { employeeType: config.staffHoursLogType, referenceId: id },
    })
    await config.deleteProfile(id)

    return NextResponse.json({ success: true, message: config.successMessage })
  } catch (error: unknown) {
    const typeLabel = (await params).employeeId || 'employee'
    console.error(`Error deleting ${typeLabel}:`, error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : `Failed to delete ${typeLabel}` },
      { status: 500 }
    )
  }
}
