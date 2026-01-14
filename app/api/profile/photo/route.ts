import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { prisma } from '@/lib/prisma'
import { validateSession } from '@/lib/auth'
import { supabaseAdmin, PROFILE_PHOTOS_STORAGE_BUCKET } from '@/lib/supabase'
import crypto from 'crypto'

const MAX_FILE_SIZE = 5 * 1024 * 1024
const ALLOWED_TYPES = ['image/png', 'image/jpeg', 'image/webp']

export async function POST(request: NextRequest) {
  try {
    const cookieStore = await cookies()
    const sessionToken = cookieStore.get('session')?.value

    if (!sessionToken) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const user = await validateSession(sessionToken)
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    if (!supabaseAdmin) {
      return NextResponse.json(
        { error: 'Supabase Storage not configured. Please set SUPABASE_SERVICE_ROLE_KEY.' },
        { status: 500 }
      )
    }

    const formData = await request.formData()
    const file = formData.get('file') as File | null

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 })
    }

    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        {
          error: `File size exceeds 5MB. Your file is ${(file.size / 1024 / 1024).toFixed(2)} MB.`,
        },
        { status: 400 }
      )
    }

    if (!ALLOWED_TYPES.includes(file.type)) {
      return NextResponse.json(
        { error: 'Invalid file type. Please upload a PNG, JPG, or WEBP image.' },
        { status: 400 }
      )
    }

    const extension = file.name.split('.').pop() || 'png'
    const filename = `${Date.now()}-${crypto.randomBytes(8).toString('hex')}.${extension}`
    const storagePath = `profiles/${user.id}/${filename}`

    const arrayBuffer = await file.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)

    const { error: uploadError } = await supabaseAdmin.storage
      .from(PROFILE_PHOTOS_STORAGE_BUCKET)
      .upload(storagePath, buffer, {
        contentType: file.type,
        upsert: true,
      })

    if (uploadError) {
      console.error('Supabase Storage upload error:', uploadError)
      return NextResponse.json({ error: 'Failed to upload photo' }, { status: 500 })
    }

    const { data } = supabaseAdmin.storage
      .from(PROFILE_PHOTOS_STORAGE_BUCKET)
      .getPublicUrl(storagePath)

    const profileImageUrl = data.publicUrl

    await prisma.userProfile.upsert({
      where: { userId: user.id },
      update: { profileImageUrl },
      create: {
        userId: user.id,
        profileImageUrl,
      },
    })

    return NextResponse.json({ profileImageUrl })
  } catch (error) {
    console.error('Error uploading profile photo:', error)
    return NextResponse.json({ error: 'Failed to upload profile photo' }, { status: 500 })
  }
}
