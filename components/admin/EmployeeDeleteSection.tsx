'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Trash2, Loader2 } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useToast } from '@/components/ui/toast'

export type EmployeeDeleteKind = 'BCBA' | 'Billing' | 'Marketing' | 'Call Center' | 'Dev Team' | 'Dev Team Member'

interface EmployeeDeleteSectionProps {
  /** Label for the type of employee (e.g. "BCBA", "Dev Team") */
  kind: EmployeeDeleteKind
  /** Display name (e.g. fullName or team name) */
  displayName: string
  /** Optional email for confirmation match */
  email?: string | null
  /** DELETE API URL (e.g. /api/admin/employees/bcba/xxx/delete) */
  deleteApiUrl: string
  /** Where to redirect after successful delete */
  redirectHref: string
  /** Optional: smaller button label (e.g. "Delete member") */
  buttonLabel?: string
}

export default function EmployeeDeleteSection({
  kind,
  displayName,
  email,
  deleteApiUrl,
  redirectHref,
  buttonLabel,
}: EmployeeDeleteSectionProps) {
  const router = useRouter()
  const { showToast } = useToast()
  const [open, setOpen] = useState(false)
  const [step, setStep] = useState<1 | 2>(1)
  const [confirmInput, setConfirmInput] = useState('')
  const [loading, setLoading] = useState(false)

  const confirmMatch =
    confirmInput.trim().toUpperCase() === 'DELETE' ||
    confirmInput.trim() === displayName ||
    (!!email && confirmInput.trim().toLowerCase() === email.toLowerCase())

  const handleOpen = () => {
    setStep(1)
    setConfirmInput('')
    setOpen(true)
  }

  const handleClose = () => {
    if (!loading) {
      setOpen(false)
      setStep(1)
      setConfirmInput('')
    }
  }

  const handleContinue = () => {
    setStep(2)
  }

  const handleDelete = async () => {
    if (!confirmMatch) return
    setLoading(true)
    try {
      const res = await fetch(deleteApiUrl, { method: 'DELETE', credentials: 'include' })
      if (res.ok) {
        showToast(`${kind} deleted successfully`, 'success')
        handleClose()
        router.push(redirectHref)
        router.refresh()
      } else {
        const data = await res.json()
        showToast(data?.error || `Failed to delete ${kind}`, 'error')
      }
    } catch (e) {
      console.error(e)
      showToast(`An error occurred while deleting. Please try again.`, 'error')
    } finally {
      setLoading(false)
    }
  }

  const step1Message = `This will permanently delete ${displayName} and all associated data. This action cannot be undone. Click "Continue" to confirm.`
  const step2Message = `Type DELETE or the ${kind.toLowerCase()}'s full name${email ? ' or email' : ''} to enable the delete button.`

  return (
    <>
      <div className="mt-4 pt-4 border-t border-gray-200 dark:border-[var(--border-subtle)]">
        <Button
          onClick={handleOpen}
          variant="outline"
          className="border-red-300 text-red-600 hover:bg-red-50 hover:border-red-400 dark:border-[var(--status-rejected-border)] dark:text-[var(--status-rejected-text)] dark:hover:bg-[var(--status-rejected-bg)] rounded-xl px-6 w-full sm:w-auto"
        >
          <Trash2 className="w-4 h-4 mr-2" />
          {buttonLabel ?? `Delete ${kind}`}
        </Button>
        <p className="text-xs text-gray-500 dark:text-[var(--text-disabled)] mt-2">
          This action cannot be undone. All data will be permanently deleted.
        </p>
      </div>

      <Dialog open={open} onOpenChange={(o) => (!o ? handleClose() : null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{step === 2 ? 'Confirm permanent delete' : 'Confirm Action'}</DialogTitle>
            <DialogDescription>{step === 1 ? step1Message : step2Message}</DialogDescription>
          </DialogHeader>
          {step === 2 && (
            <div className="space-y-3 py-2">
              <Label htmlFor="employee-delete-confirm">
                Type DELETE or the {kind.toLowerCase()}&apos;s full name{email ? ' or email' : ''}
              </Label>
              <Input
                id="employee-delete-confirm"
                value={confirmInput}
                onChange={(e) => setConfirmInput(e.target.value)}
                placeholder="DELETE"
                className="font-mono"
                autoComplete="off"
              />
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={handleClose} disabled={loading}>
              Cancel
            </Button>
            {step === 2 ? (
              <Button
                onClick={handleDelete}
                disabled={!confirmMatch || loading}
                variant="destructive"
                className="bg-red-600 hover:bg-red-700"
              >
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Delete permanently'}
              </Button>
            ) : (
              <Button onClick={handleContinue} disabled={loading} className="bg-orange-500 hover:bg-orange-600 text-white">
                Continue
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
