'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Loader2 } from 'lucide-react'
import { useToast } from '@/components/ui/toast'

interface InterviewClaimControlsProps {
  interviewId: string
  interviewStatus: string
  candidateName: string
  scheduledAt: string
  currentUserId: string
  claimedByUserId: string | null
  claimedByName: string | null
}

export default function InterviewClaimControls({
  interviewId,
  interviewStatus,
  candidateName,
  scheduledAt,
  currentUserId,
  claimedByUserId,
  claimedByName,
}: InterviewClaimControlsProps) {
  const router = useRouter()
  const { showToast } = useToast()
  const [loading, setLoading] = useState(false)
  const [unclaimOpen, setUnclaimOpen] = useState(false)
  const [reason, setReason] = useState('')
  const [localClaimedByUserId, setLocalClaimedByUserId] = useState<string | null>(claimedByUserId)
  const [localClaimedByName, setLocalClaimedByName] = useState<string | null>(claimedByName)

  const claimed = !!localClaimedByUserId
  const isMine = localClaimedByUserId === currentUserId

  const startsInHours = useMemo(() => {
    const diff = new Date(scheduledAt).getTime() - Date.now()
    return diff / (1000 * 60 * 60)
  }, [scheduledAt])

  const onClaim = async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/admin/interviews/${interviewId}/claim`, {
        method: 'POST',
        credentials: 'include',
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        showToast(data.error || 'Failed to claim interview', 'error')
        return
      }
      setLocalClaimedByUserId(currentUserId)
      setLocalClaimedByName('You')
      showToast('Interview claimed', 'success')
      router.refresh()
    } catch {
      showToast('Network error while claiming', 'error')
    } finally {
      setLoading(false)
    }
  }

  const onUnclaim = async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/admin/interviews/${interviewId}/unclaim`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ reason }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        showToast(data.error || 'Failed to release interview', 'error')
        return
      }
      setLocalClaimedByUserId(null)
      setLocalClaimedByName(null)
      setUnclaimOpen(false)
      setReason('')
      showToast('Interview released. All admins have been notified.', 'success')
      if (startsInHours <= 2) {
        showToast('⚠️ This interview is very soon — please make sure someone claims it', 'error')
      }
      router.refresh()
    } catch {
      showToast('Network error while releasing interview', 'error')
    } finally {
      setLoading(false)
    }
  }

  if (interviewStatus !== 'SCHEDULED') {
    return <span className="text-sm text-gray-500">{localClaimedByName || '—'}</span>
  }

  return (
    <>
      <div className="flex items-center gap-2">
        {claimed ? (
          <>
            <span className="text-xs text-gray-500">
              Claimed by <span className="font-medium text-green-700">{localClaimedByName || 'Admin'}</span>
            </span>
            {isMine ? (
              <Button
                variant="outline"
                size="sm"
                className="h-7 px-2 text-xs border-gray-300 text-gray-700 hover:bg-gray-50"
                onClick={() => setUnclaimOpen(true)}
                disabled={loading}
              >
                Unclaim
              </Button>
            ) : null}
          </>
        ) : (
          <Button
            variant="outline"
            size="sm"
            onClick={onClaim}
            disabled={loading}
            className="text-xs h-7 px-2.5 border-orange-400 text-orange-600 hover:bg-orange-50"
          >
            {loading ? <Loader2 className="w-3 h-3 animate-spin" /> : 'Claim'}
          </Button>
        )}
      </div>

      {unclaimOpen ? (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
          <div className="w-full max-w-md rounded-xl bg-white border shadow-xl p-5">
            <h3 className="text-lg font-semibold">Release this interview?</h3>
            <div className="mt-3 text-sm text-gray-600 space-y-1">
              <p><span className="font-medium text-gray-800">Candidate:</span> {candidateName}</p>
              <p><span className="font-medium text-gray-800">Date:</span> {new Date(scheduledAt).toLocaleString('en-US', { timeZone: 'America/New_York' })}</p>
            </div>
            {startsInHours <= 24 ? (
              <p className="mt-3 rounded-md border border-red-200 bg-red-50 text-red-700 text-xs px-2 py-1">
                ⚠️ Urgent: this interview is within 24 hours.
              </p>
            ) : null}
            <div className="mt-4">
              <label className="text-sm font-medium">Optional: Reason for unclaiming</label>
              <input
                className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                placeholder="e.g. Schedule conflict, emergency, etc."
                value={reason}
                onChange={(e) => setReason(e.target.value)}
              />
            </div>
            <p className="mt-3 text-xs text-gray-500">All admins will be notified so someone else can claim it.</p>
            <div className="mt-4 flex justify-end gap-2">
              <Button variant="outline" onClick={() => setUnclaimOpen(false)} disabled={loading}>Keep It</Button>
              <Button className="bg-red-600 hover:bg-red-700 text-white" onClick={onUnclaim} disabled={loading}>
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Release Interview'}
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  )
}
