import { NextResponse } from 'next/server'
import {
  getCurrentUser,
  isTrainingManager,
  canOverrideTrainingRequirement,
  isAdmin,
  canAccessTrainingPortal,
} from '@/lib/auth'

export const dynamic = 'force-dynamic'

export async function GET() {
  const user = await getCurrentUser()
  if (!user) {
    return NextResponse.json({ authenticated: false }, { status: 200 })
  }
  return NextResponse.json({
    authenticated: true,
    id: user.id,
    role: user.role,
    email: user.email,
    name: user.name,
    rbtProfileId: user.rbtProfileId,
    trainingManager: isTrainingManager(user),
    trainingPortal: canAccessTrainingPortal(user),
    canOverrideArtemisTraining: canOverrideTrainingRequirement(user),
    isAdmin: isAdmin(user),
  })
}
