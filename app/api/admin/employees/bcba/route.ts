import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAdminSession } from '@/lib/auth'
import { sendGenericEmail, generateTeamWelcomeEmail } from '@/lib/email'
import { ensureEmployeeForBcbaProfile } from '@/lib/employees'
import { makePublicUrl } from '@/lib/baseUrl'

function slugifyName(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 40)
}

export async function POST(request: NextRequest) {
  try {
    const auth = await requireAdminSession()
    if (auth.response) return auth.response
    const actor = auth.user!

    const body = await request.json()
    const {
      fullName,
      email,
      phone,
      certificationNumber,
      certificationExpiresAt,
      isSupervisor,
      preferredRegions,
      notes,
      status,
    } = body as {
      fullName?: string
      email?: string
      phone?: string
      certificationNumber?: string
      certificationExpiresAt?: string
      isSupervisor?: boolean
      preferredRegions?: string
      notes?: string
      status?: string
    }

    if (!fullName?.trim()) {
      return NextResponse.json({ error: 'Full name is required' }, { status: 400 })
    }

    const emailNorm = email?.trim().toLowerCase() || ''
    if (!emailNorm) {
      return NextResponse.json(
        { error: 'Email is required so the BCBA can log in' },
        { status: 400 }
      )
    }

    const phoneNorm = phone?.trim() || null

    const existingUser = await prisma.user.findFirst({
      where: { email: { equals: emailNorm, mode: 'insensitive' } },
      select: { id: true, role: true, name: true, bcbaProfile: { select: { id: true } } },
    })
    if (existingUser?.bcbaProfile) {
      return NextResponse.json(
        { error: 'A BCBA profile already exists for this email' },
        { status: 409 }
      )
    }
    if (existingUser && existingUser.role !== 'BCBA') {
      return NextResponse.json(
        {
          error: `Email is already used by a ${existingUser.role} account — use a different email`,
        },
        { status: 409 }
      )
    }

    if (phoneNorm) {
      const phoneTaken = await prisma.user.findFirst({
        where: {
          phoneNumber: phoneNorm,
          ...(existingUser ? { id: { not: existingUser.id } } : {}),
        },
        select: { id: true },
      })
      if (phoneTaken) {
        return NextResponse.json(
          { error: 'Phone number is already used by another account' },
          { status: 409 }
        )
      }
    }

    const result = await prisma.$transaction(async (tx) => {
      const user =
        existingUser ??
        (await tx.user.create({
          data: {
            email: emailNorm,
            phoneNumber: phoneNorm,
            name: fullName.trim(),
            role: 'BCBA',
            isActive: true,
          },
        }))

      if (existingUser) {
        await tx.user.update({
          where: { id: user.id },
          data: {
            name: fullName.trim(),
            role: 'BCBA',
            isActive: true,
            ...(phoneNorm ? { phoneNumber: phoneNorm } : {}),
          },
        })
      }

      const crmExisting = await tx.userCrmRole.findUnique({
        where: { userId_role: { userId: user.id, role: 'BCBA' } },
      })
      if (crmExisting?.revokedAt) {
        await tx.userCrmRole.update({
          where: { id: crmExisting.id },
          data: {
            revokedAt: null,
            revokedByUserId: null,
            grantedAt: new Date(),
            grantedByUserId: actor.id,
          },
        })
      } else if (!crmExisting) {
        await tx.userCrmRole.create({
          data: {
            userId: user.id,
            role: 'BCBA',
            grantedByUserId: actor.id,
          },
        })
      }

      const profile = await tx.bCBAProfile.create({
        data: {
          userId: user.id,
          fullName: fullName.trim(),
          email: emailNorm,
          phone: phoneNorm,
          certificationNumber: certificationNumber?.trim() || null,
          certificationExpiresAt: certificationExpiresAt
            ? new Date(certificationExpiresAt)
            : null,
          isSupervisor: !!isSupervisor,
          preferredRegions: preferredRegions?.trim() || null,
          notes: notes?.trim() || null,
          status: status?.trim() || 'Active',
        },
      })

      return { profile, userId: user.id }
    })

    await ensureEmployeeForBcbaProfile(result.profile.id)

    // Seed completion rows for any active BCBA onboarding docs
    const docs = await prisma.bcbaOnboardingDocument.findMany({
      where: { isActive: true },
      select: { id: true },
    })
    if (docs.length > 0) {
      await prisma.bcbaOnboardingCompletion.createMany({
        data: docs.map((d) => ({
          bcbaProfileId: result.profile.id,
          documentId: d.id,
          status: 'NOT_STARTED',
        })),
        skipDuplicates: true,
      })
    }

    const loginUrl = makePublicUrl('/login')
    const { subject, html } = generateTeamWelcomeEmail(result.profile.fullName, 'BCBA')
    const htmlWithLogin = html.replace(
      '</div>\n        <div class="footer">',
      `<p style="margin-top:24px;padding:16px;background:#FFF7ED;border-radius:8px;">
            <strong>Log in:</strong> Use this email at
            <a href="${loginUrl}" style="color:#E4893D;">${loginUrl}</a>
            to open your clinical portal and complete onboarding documents.
          </p>
        </div>
        <div class="footer">`
    )
    await sendGenericEmail(emailNorm, subject, htmlWithLogin)

    return NextResponse.json({
      id: result.profile.id,
      userId: result.userId,
      success: true,
      slugHint: slugifyName(fullName),
    })
  } catch (error) {
    console.error('Error creating BCBA:', error)
    return NextResponse.json({ error: 'Failed to create BCBA' }, { status: 500 })
  }
}
