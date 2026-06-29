'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Trash2 } from 'lucide-react'

export default function DeleteCycleButton({
  cycleId,
  cycleLabel,
  status,
  redirectTo = '/billing/dashboard',
  variant = 'outline',
  size = 'sm',
  className,
}: {
  cycleId: string
  cycleLabel: string
  status: string
  redirectTo?: string
  variant?: 'outline' | 'ghost' | 'destructive'
  size?: 'sm' | 'default'
  className?: string
}) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)

  const onDelete = async () => {
    const finalized = status === 'FINALIZED' || status === 'PAID'
    const msg = finalized
      ? `Delete "${cycleLabel}"? This cycle is ${status}. All entries, sessions, and hour confirmations will be permanently removed.`
      : `Delete "${cycleLabel}"? This cannot be undone.`
    if (!confirm(msg)) return

    setLoading(true)
    try {
      const res = await fetch(`/api/billing/cycles/${cycleId}`, {
        method: 'DELETE',
        credentials: 'include',
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        alert(data.error || 'Could not delete cycle')
        return
      }
      if (redirectTo) {
        router.push(redirectTo)
      } else {
        router.refresh()
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <Button
      type="button"
      variant={variant}
      size={size}
      className={className}
      disabled={loading}
      onClick={(e) => {
        e.preventDefault()
        e.stopPropagation()
        void onDelete()
      }}
    >
      <Trash2 className="w-4 h-4 mr-2" />
      {loading ? 'Deleting…' : 'Delete'}
    </Button>
  )
}
