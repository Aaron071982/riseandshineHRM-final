'use client'

import { useState } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'
import { Loader2 } from 'lucide-react'
import { useToast } from '@/components/ui/toast'
import OnboardingPdfViewer from '@/components/onboarding/OnboardingPdfViewer'

type Doc = {
  id: string
  title: string
  pdfUrl: string | null
}

export default function NoticeReceiptFlow({
  document,
  onComplete,
}: {
  document: Doc
  onComplete: () => void
}) {
  const { showToast } = useToast()
  const [ack, setAck] = useState(false)
  const [scrolled, setScrolled] = useState(false)
  const [loading, setLoading] = useState(false)

  const submit = async () => {
    if (!ack) return
    setLoading(true)
    try {
      const res = await fetch('/api/onboarding/notice-receipt', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ documentId: document.id }),
      })
      const data = await res.json()
      if (!res.ok) {
        showToast(data.error || 'Failed', 'error')
        return
      }
      showToast('Notice acknowledged', 'success')
      onComplete()
    } catch {
      showToast('Something went wrong', 'error')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-4">
      <OnboardingPdfViewer
        documentId={document.id}
        pdfUrl={document.pdfUrl}
        title={document.title}
        onScrolledToBottom={() => setScrolled(true)}
      />
      <Card>
        <CardContent className="pt-6 space-y-4">
          <div className="flex items-start gap-3">
            <Checkbox
              id="notice-ack"
              checked={ack}
              disabled={!scrolled}
              onCheckedChange={(c) => setAck(c === true)}
            />
            <Label htmlFor="notice-ack" className="text-sm font-normal cursor-pointer">
              I acknowledge receipt of this notice
            </Label>
          </div>
          {!scrolled && (
            <p className="text-xs text-amber-700">Scroll through the document to enable acknowledgment.</p>
          )}
          <Button onClick={submit} disabled={!ack || loading} className="bg-[#e36f1e] hover:bg-[#c75f18]">
            {loading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
            Confirm receipt
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}
