import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { validateSession } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { supabaseAdmin, STORAGE_BUCKET } from '@/lib/supabase'
import type { FolderType } from '@prisma/client'

export async function POST(request: NextRequest) {
  const cookieStore = await cookies()
  const token = cookieStore.get('session')?.value
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const user = await validateSession(token)
  if (!user?.rbtProfileId) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const formData = await request.formData()
  const file = formData.get('file')
  if (!(file instanceof File)) {
    return NextResponse.json({ error: 'file required' }, { status: 400 })
  }
  const folderType = (formData.get('folderType') as FolderType) || 'PERSONAL_DOCUMENTS'
  const notes = formData.get('notes') as string | null
  const ext = file.name.split('.').pop() || 'bin'
  const path = `${user.rbtProfileId}/resources/${Date.now()}.${ext}`
  const buffer = Buffer.from(await file.arrayBuffer())

  if (!supabaseAdmin) {
    return NextResponse.json({ error: 'Storage not configured' }, { status: 503 })
  }
  const { error } = await supabaseAdmin.storage.from(STORAGE_BUCKET).upload(path, buffer, {
    contentType: file.type,
  })
  if (error) return NextResponse.json({ error: 'Upload failed' }, { status: 500 })

  await prisma.employeeDocumentFolder.create({
    data: {
      rbtProfileId: user.rbtProfileId,
      folderType,
      fileUrl: path,
      fileName: file.name,
      uploadedBy: user.id,
      notes,
    },
  })

  return NextResponse.json({ success: true })
}
