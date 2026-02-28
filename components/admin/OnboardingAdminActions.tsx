'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { useToast } from '@/components/ui/toast'
import { Wrench, Mail, Loader2 } from 'lucide-react'

export default function OnboardingAdminActions() {
  const { showToast } = useToast()
  const [repairing, setRepairing] = useState(false)
  const [sendingId, setSendingId] = useState(false)

  const handleRepairTasks = async () => {
    setRepairing(true)
    try {
      const res = await fetch('/api/admin/onboarding/repair-tasks', {
        method: 'POST',
        credentials: 'include',
      })
      const data = await res.json()
      if (res.ok) {
        showToast(data.message || 'Onboarding tasks repaired.', 'success')
        window.location.reload()
      } else {
        showToast(data.error || 'Failed to repair tasks', 'error')
      }
    } catch (e) {
      console.error(e)
      showToast('An error occurred. Please try again.', 'error')
    } finally {
      setRepairing(false)
    }
  }

  const handleSendIdReminder = async () => {
    setSendingId(true)
    try {
      const res = await fetch('/api/admin/rbts/send-id-reminder', {
        method: 'POST',
        credentials: 'include',
      })
      const data = await res.json()
      if (res.ok) {
        showToast(data.message || 'ID reminder emails sent.', 'success')
      } else {
        showToast(data.error || 'Failed to send ID reminders', 'error')
      }
    } catch (e) {
      console.error(e)
      showToast('An error occurred. Please try again.', 'error')
    } finally {
      setSendingId(false)
    }
  }

  return (
    <Card className="border border-gray-200 dark:border-[var(--border-subtle)] bg-white dark:bg-[var(--bg-elevated)]">
      <CardHeader>
        <CardTitle className="text-lg font-semibold text-gray-900 dark:text-[var(--text-primary)]">Admin actions</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-wrap gap-3">
        <Button
          variant="outline"
          onClick={handleRepairTasks}
          disabled={repairing || sendingId}
          className="dark:border-[var(--border-subtle)] dark:text-[var(--text-secondary)] dark:hover:bg-[var(--bg-elevated-hover)]"
        >
          {repairing ? (
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
          ) : (
            <Wrench className="h-4 w-4 mr-2" />
          )}
          Repair onboarding tasks for all hired RBTs
        </Button>
        <Button
          variant="outline"
          onClick={handleSendIdReminder}
          disabled={repairing || sendingId}
          className="dark:border-[var(--border-subtle)] dark:text-[var(--text-secondary)] dark:hover:bg-[var(--bg-elevated-hover)]"
        >
          {sendingId ? (
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
          ) : (
            <Mail className="h-4 w-4 mr-2" />
          )}
          Email all hired RBTs: Send ID to info@riseandshine.nyc
        </Button>
      </CardContent>
    </Card>
  )
}
