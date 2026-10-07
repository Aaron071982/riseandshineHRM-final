'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { useToast } from '@/components/ui/toast'
import { Loader2 } from 'lucide-react'
import AdminI9Section from './AdminI9Section'

export default function AdminOnboardingActivation({
  rbtProfileId,
  backgroundCheckClearedAt,
  supervisionCountersignedAt,
  supervisionContractStatus,
  i9,
}: {
  rbtProfileId: string
  backgroundCheckClearedAt: string | null
  supervisionCountersignedAt: string | null
  supervisionContractStatus: string | null
  i9?: {
    section1CompletedAt: string | null
    section2CompletedAt: string | null
    section2Notes: string | null
  }
}) {
  const { showToast } = useToast()
  const [loading, setLoading] = useState<string | null>(null)

  const markBg = async () => {
    setLoading('bg')
    try {
      const res = await fetch(`/api/admin/rbts/${rbtProfileId}/onboarding/background-cleared`, {
        method: 'POST',
        credentials: 'include',
      })
      if (!res.ok) throw new Error()
      showToast('Background check marked cleared', 'success')
      window.location.reload()
    } catch {
      showToast('Failed', 'error')
    } finally {
      setLoading(null)
    }
  }

  const markSupervision = async () => {
    setLoading('sup')
    try {
      const res = await fetch(`/api/admin/rbts/${rbtProfileId}/onboarding/supervision-countersign`, {
        method: 'POST',
        credentials: 'include',
      })
      if (!res.ok) throw new Error()
      showToast('Supervision contract countersigned', 'success')
      window.location.reload()
    } catch {
      showToast('Failed', 'error')
    } finally {
      setLoading(null)
    }
  }

  const downloadAll = () => {
    window.open(`/api/admin/rbts/${rbtProfileId}/onboarding/download-all`, '_blank')
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-2">
        <CardTitle className="text-lg">Activation (Tasks 31–33)</CardTitle>
        <Button variant="outline" size="sm" onClick={downloadAll}>
          Download all (ZIP)
        </Button>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <p className="font-medium">Task 31: Background check cleared</p>
            <p className="text-sm text-gray-500">
              {backgroundCheckClearedAt
                ? `Cleared ${new Date(backgroundCheckClearedAt).toLocaleString()}`
                : 'Pending'}
            </p>
          </div>
          {!backgroundCheckClearedAt && (
            <Button size="sm" onClick={markBg} disabled={loading === 'bg'}>
              {loading === 'bg' ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Mark cleared'}
            </Button>
          )}
        </div>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <p className="font-medium">Task 32: Supervision countersigned</p>
            <p className="text-sm text-gray-500">
              Status: {supervisionContractStatus ?? '—'}
              {supervisionCountersignedAt &&
                ` · ${new Date(supervisionCountersignedAt).toLocaleString()}`}
            </p>
          </div>
          {!supervisionCountersignedAt && (
            <Button size="sm" onClick={markSupervision} disabled={loading === 'sup'}>
              {loading === 'sup' ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Mark countersigned'}
            </Button>
          )}
        </div>
        {i9 && (
          <AdminI9Section
            rbtProfileId={rbtProfileId}
            section1CompletedAt={i9.section1CompletedAt}
            section2CompletedAt={i9.section2CompletedAt}
            section2Notes={i9.section2Notes}
          />
        )}
      </CardContent>
    </Card>
  )
}
