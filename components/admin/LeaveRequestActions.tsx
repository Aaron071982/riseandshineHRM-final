'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'

interface LeaveRequestActionsProps {
  requestId: string
}

export default function LeaveRequestActions({ requestId }: LeaveRequestActionsProps) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [action, setAction] = useState<'approve' | 'deny' | null>(null)
  const [notes, setNotes] = useState('')

  const handleAction = async () => {
    if (!action) return

    setLoading(true)
    try {
      const response = await fetch(`/api/admin/leave-requests/${requestId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status: action === 'approve' ? 'APPROVED' : 'DENIED',
          adminNotes: notes,
        }),
      })

      if (response.ok) {
        router.refresh()
        setAction(null)
        setNotes('')
      }
    } catch (error) {
      console.error('Error updating leave request:', error)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex gap-2">
      <Dialog open={action === 'approve'} onOpenChange={(open) => !open && setAction(null)}>
        <DialogTrigger asChild>
          <Button
            size="sm"
            variant="outline"
            className="bg-green-50 hover:bg-green-100 text-green-700"
            onClick={() => setAction('approve')}
          >
            Approve
          </Button>
        </DialogTrigger>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Approve Leave Request</DialogTitle>
            <DialogDescription>Add optional notes for this approval</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="approve-notes">Notes (optional)</Label>
              <Input
                id="approve-notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Add notes..."
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAction(null)}>
              Cancel
            </Button>
            <Button
              onClick={handleAction}
              disabled={loading}
              className="bg-green-600 hover:bg-green-700"
            >
              {loading ? 'Approving...' : 'Approve'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={action === 'deny'} onOpenChange={(open) => !open && setAction(null)}>
        <DialogTrigger asChild>
          <Button
            size="sm"
            variant="outline"
            className="bg-red-50 hover:bg-red-100 text-red-700"
            onClick={() => setAction('deny')}
          >
            Deny
          </Button>
        </DialogTrigger>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Deny Leave Request</DialogTitle>
            <DialogDescription>Add notes explaining the denial</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="deny-notes">Notes *</Label>
              <Input
                id="deny-notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Explain why this request is being denied..."
                required
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAction(null)}>
              Cancel
            </Button>
            <Button
              onClick={handleAction}
              disabled={loading || !notes}
              className="bg-red-600 hover:bg-red-700"
            >
              {loading ? 'Denying...' : 'Deny'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

