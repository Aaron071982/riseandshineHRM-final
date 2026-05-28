'use client'

import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Download, Upload, Loader2, ExternalLink } from 'lucide-react'
import { useToast } from '@/components/ui/toast'

const RESOURCES = [
  {
    title: 'Sexual Harassment Complaint Form',
    description:
      'To file a complaint, download this form, complete it, and email to info@riseandshine.nyc or upload here.',
    downloadPath: '/onboarding-documents/RiseShine_SexualHarassmentComplaintForm_v1.docx',
    uploadable: true,
  },
  {
    title: 'Incident Report Form',
    description: 'Complete and submit to your supervising BCBA.',
    downloadPath: null,
    externalNote: 'See Incident Reporting Policy in My Tasks.',
  },
  {
    title: 'BACB RBT Ethics Code',
    description: 'Official BACB ethics resources.',
    href: 'https://www.bacb.com/ethics-information/',
  },
  {
    title: 'BACB RBT Handbook',
    description: 'Registered Behavior Technician handbook.',
    href: 'https://www.bacb.com/rbt/rbt-handbook/',
  },
]

export default function RbtResourcesPage({ rbtProfileId }: { rbtProfileId: string }) {
  const { showToast } = useToast()
  const [uploading, setUploading] = useState(false)

  const uploadComplaint = async (file: File) => {
    setUploading(true)
    try {
      const fd = new FormData()
      fd.append('file', file)
      fd.append('folderType', 'PERSONAL_DOCUMENTS')
      fd.append('notes', 'Sexual harassment complaint form')
      const res = await fetch('/api/rbt/resources/upload', { method: 'POST', body: fd })
      if (!res.ok) {
        const d = await res.json()
        showToast(d.error || 'Upload failed', 'error')
        return
      }
      showToast('Complaint form uploaded', 'success')
    } catch {
      showToast('Upload failed', 'error')
    } finally {
      setUploading(false)
    }
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <h1 className="text-2xl font-bold">Resources</h1>
      <p className="text-gray-600 text-sm">
        Permanent workplace resources — separate from onboarding tasks.
      </p>
      {RESOURCES.map((r) => (
        <Card key={r.title}>
          <CardHeader>
            <CardTitle className="text-lg">{r.title}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-gray-600">{r.description}</p>
            {r.downloadPath && (
              <Button variant="outline" asChild>
                <a href={r.downloadPath} download>
                  <Download className="w-4 h-4 mr-2" />
                  Download
                </a>
              </Button>
            )}
            {r.href && (
              <Button variant="outline" asChild>
                <a href={r.href} target="_blank" rel="noopener noreferrer">
                  <ExternalLink className="w-4 h-4 mr-2" />
                  Open link
                </a>
              </Button>
            )}
            {r.uploadable && (
              <div>
                <input
                  type="file"
                  accept=".pdf,.doc,.docx,image/*"
                  className="text-sm"
                  onChange={(e) => {
                    const f = e.target.files?.[0]
                    if (f) uploadComplaint(f)
                  }}
                  disabled={uploading}
                />
                {uploading && <Loader2 className="w-4 h-4 animate-spin inline ml-2" />}
              </div>
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  )
}
