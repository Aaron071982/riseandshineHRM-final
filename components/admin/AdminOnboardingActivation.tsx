'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { useToast } from '@/components/ui/toast'
import { Loader2 } from 'lucide-react'

export default function AdminOnboardingActivation({
  rbtProfileId,
  backgroundCheckClearedAt,
  supervisionCountersignedAt,
  supervisionContractStatus,
}: {
  rbtProfileId: string
  backgroundCheckClearedAt: string | null
  supervisionCountersignedAt: string | null
  supervisionContractStatus: string | null
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
        <CardTitle className="text-lg">Activation (Tasks 31–32)</CardTitle>
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
      </CardContent>
    </Card>
  )
}
