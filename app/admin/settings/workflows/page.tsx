'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import { Loader2, Save, Settings } from 'lucide-react'
import { useToast } from '@/components/ui/toast'
import type { WorkflowSettings } from '@/lib/workflow-settings'

export default function WorkflowSettingsPage() {
  const { showToast } = useToast()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [settings, setSettings] = useState<WorkflowSettings | null>(null)

  useEffect(() => {
    fetch('/api/admin/settings/workflows', { credentials: 'include' })
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error('Failed to load'))))
      .then((data) => setSettings(data))
      .catch(() => showToast('Failed to load workflow settings', 'error'))
      .finally(() => setLoading(false))
  }, [showToast])

  const update = (patch: Partial<WorkflowSettings>) => {
    if (!settings) return
    setSettings({ ...settings, ...patch })
  }

  const handleSave = async () => {
    if (!settings) return
    setSaving(true)
    try {
      const res = await fetch('/api/admin/settings/workflows', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(settings),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        showToast(data.error || 'Failed to save', 'error')
        return
      }
      setSettings(data)
      showToast('Settings saved', 'success')
    } catch {
      showToast('Failed to save settings', 'error')
    } finally {
      setSaving(false)
    }
  }

  if (loading || !settings) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="h-8 w-8 animate-spin text-orange-600" />
      </div>
    )
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold text-gray-900 dark:text-[var(--text-primary)] flex items-center gap-2">
          <Settings className="h-8 w-8 text-orange-600 dark:text-[var(--orange-primary)]" />
          Workflow Settings
        </h1>
        <p className="mt-1 text-gray-600 dark:text-[var(--text-tertiary)]">
          Control automated emails and staleness alerts.
        </p>
      </div>

      <Card className="border border-gray-200 dark:border-[var(--border-subtle)] bg-white dark:bg-[var(--bg-elevated)]">
        <CardHeader>
          <CardTitle className="text-xl">Automated emails</CardTitle>
          <CardDescription className="dark:text-[var(--text-tertiary)]">
            Toggle each email sent when candidate status changes.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex items-center justify-between gap-4">
            <Label htmlFor="emailReachOut" className="cursor-pointer flex-1">
              Send email when candidate moves to Reach Out
            </Label>
            <Checkbox
              id="emailReachOut"
              checked={settings.emailReachOut}
              onCheckedChange={(c) => update({ emailReachOut: c === true })}
            />
          </div>
          <div className="flex items-center justify-between gap-4">
            <Label htmlFor="emailToInterview" className="cursor-pointer flex-1">
              Send email when interview is scheduled (To Interview)
            </Label>
            <Checkbox
              id="emailToInterview"
              checked={settings.emailToInterview}
              onCheckedChange={(c) => update({ emailToInterview: c === true })}
            />
          </div>
          <div className="flex items-center justify-between gap-4">
            <Label htmlFor="emailHired" className="cursor-pointer flex-1">
              Send welcome email when hired
            </Label>
            <Checkbox
              id="emailHired"
              checked={settings.emailHired}
              onCheckedChange={(c) => update({ emailHired: c === true })}
            />
          </div>
          <div className="flex items-center justify-between gap-4">
            <Label htmlFor="emailRejection" className="cursor-pointer flex-1">
              Send rejection email
            </Label>
            <Checkbox
              id="emailRejection"
              checked={settings.emailRejection}
              onCheckedChange={(c) => update({ emailRejection: c === true })}
            />
          </div>
          <div className="flex items-center justify-between gap-4">
            <Label htmlFor="notifyAdminsHired" className="cursor-pointer flex-1">
              Notify all admins when a candidate is hired
            </Label>
            <Checkbox
              id="notifyAdminsHired"
              checked={settings.notifyAdminsHired}
              onCheckedChange={(c) => update({ notifyAdminsHired: c === true })}
            />
          </div>
          <div className="flex items-center justify-between gap-4">
            <Label htmlFor="stalenessDigest" className="cursor-pointer flex-1">
              Send staleness digest (every other day)
            </Label>
            <Checkbox
              id="stalenessDigest"
              checked={settings.stalenessDigest}
              onCheckedChange={(c) => update({ stalenessDigest: c === true })}
            />
          </div>
        </CardContent>
      </Card>

      <Card className="border border-gray-200 dark:border-[var(--border-subtle)] bg-white dark:bg-[var(--bg-elevated)]">
        <CardHeader>
          <CardTitle className="text-xl">Staleness thresholds</CardTitle>
          <CardDescription className="dark:text-[var(--text-tertiary)]">
            Days after which to include candidates in the digest.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label htmlFor="daysReachOut">Alert after X days in Reach Out</Label>
            <Input
              id="daysReachOut"
              type="number"
              min={1}
              value={settings.stalenessDaysReachOut}
              onChange={(e) => update({ stalenessDaysReachOut: parseInt(e.target.value, 10) || 7 })}
              className="mt-2 max-w-[120px] dark:bg-[var(--bg-input)] dark:border-[var(--border-subtle)]"
            />
          </div>
          <div>
            <Label htmlFor="daysToInterview">Alert after X days in To Interview</Label>
            <Input
              id="daysToInterview"
              type="number"
              min={1}
              value={settings.stalenessDaysToInterview}
              onChange={(e) => update({ stalenessDaysToInterview: parseInt(e.target.value, 10) || 5 })}
              className="mt-2 max-w-[120px] dark:bg-[var(--bg-input)] dark:border-[var(--border-subtle)]"
            />
          </div>
          <div>
            <Label htmlFor="daysOnboarding">Alert after X days onboarding not started</Label>
            <Input
              id="daysOnboarding"
              type="number"
              min={1}
              value={settings.stalenessDaysOnboarding}
              onChange={(e) => update({ stalenessDaysOnboarding: parseInt(e.target.value, 10) || 3 })}
              className="mt-2 max-w-[120px] dark:bg-[var(--bg-input)] dark:border-[var(--border-subtle)]"
            />
          </div>
        </CardContent>
      </Card>

      <Card className="border border-gray-200 dark:border-[var(--border-subtle)] bg-white dark:bg-[var(--bg-elevated)]">
        <CardHeader>
          <CardTitle className="text-xl">Digest recipients</CardTitle>
          <CardDescription className="dark:text-[var(--text-tertiary)]">
            Email addresses that receive the staleness digest. One per line or comma-separated. Leave empty to send to all active admins.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <textarea
            value={settings.stalenessRecipients.join('\n')}
            onChange={(e) => update({ stalenessRecipients: e.target.value.split(/[\n,]+/).map((s) => s.trim()).filter(Boolean) })}
            rows={4}
            placeholder="admin@example.com"
            className="w-full rounded-md border border-gray-300 dark:border-[var(--border-subtle)] bg-white dark:bg-[var(--bg-input)] px-3 py-2 text-sm dark:text-[var(--text-primary)] placeholder:text-gray-500"
          />
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button onClick={handleSave} disabled={saving} className="bg-orange-600 hover:bg-orange-700">
          {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}
          Save
        </Button>
      </div>
    </div>
  )
}
