'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Loader2, Upload } from 'lucide-react'
import { useToast } from '@/components/ui/toast'

export default function DocumentUploadFlow({
  documentId,
  title,
  description,
  onComplete,
}: {
  documentId: string
  title: string
  description?: string
  onComplete: () => void
}) {
  const { showToast } = useToast()
  const [file, setFile] = useState<File | null>(null)
  const [loading, setLoading] = useState(false)

  const upload = async () => {
    if (!file) return
    if (file.size > 10 * 1024 * 1024) {
      showToast('File must be under 10MB', 'error')
      return
    }
    setLoading(true)
    try {
      const fd = new FormData()
      fd.append('file', file)
      const res = await fetch(`/api/rbt/onboarding/documents/${documentId}/upload`, {
        method: 'POST',
        body: fd,
        credentials: 'include',
      })
      const data = await res.json()
      if (!res.ok) {
        showToast(data.error || 'Upload failed', 'error')
        return
      }
      showToast('Upload complete', 'success')
      onComplete()
    } catch {
      showToast('Upload failed', 'error')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-4">
      <h3 className="font-semibold">{title}</h3>
      {description && <p className="text-sm text-gray-600">{description}</p>}
      <p className="text-sm text-gray-500">PDF, JPG, or PNG — max 10MB</p>
      <input
        type="file"
        accept=".pdf,image/jpeg,image/png"
        className="block w-full text-sm file:mr-4 file:py-2 file:px-4 file:rounded file:border-0 file:bg-[#e36f1e] file:text-white"
        onChange={(e) => setFile(e.target.files?.[0] ?? null)}
      />
      <Button onClick={upload} disabled={!file || loading}>
        {loading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Upload className="w-4 h-4 mr-2" />}
        Upload
      </Button>
    </div>
  )
}
