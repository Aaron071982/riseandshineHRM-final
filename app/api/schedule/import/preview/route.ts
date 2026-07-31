import { NextRequest, NextResponse } from 'next/server'
import { requireScheduleSession } from '@/lib/schedule/access'
import { deriveWeeklySchedulesFromArtemis } from '@/lib/schedule-import/deriveWeekly'
import { buildScheduleImportPreview } from '@/lib/schedule-import/persist'

export const dynamic = 'force-dynamic'

/** Parse Artemis file → derived weekly schedules + match preview (does not persist). */
export async function POST(request: NextRequest) {
  const auth = await requireScheduleSession()
  if (auth.response) return auth.response

  const formData = await request.formData()
  const file = formData.get('file')
  if (!file || !(file instanceof Blob)) {
    return NextResponse.json({ error: 'No file uploaded' }, { status: 400 })
  }

  const fileName = file instanceof File ? file.name : 'upload.xlsx'
  const buffer = Buffer.from(await file.arrayBuffer())

  try {
    const derived = await deriveWeeklySchedulesFromArtemis(buffer)
    const preview = await buildScheduleImportPreview(derived)
    return NextResponse.json({
      fileName,
      preview,
      /** Serialized derived payload for commit step (client echoes back). */
      derived,
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to parse file'
    return NextResponse.json({ error: message }, { status: 400 })
  }
}
