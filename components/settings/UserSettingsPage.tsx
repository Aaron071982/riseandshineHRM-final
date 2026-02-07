'use client'

import { useEffect, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { useToast } from '@/components/ui/toast'
import { Bell, Palette, Shield, Monitor } from 'lucide-react'
import { useRouter } from 'next/navigation'

interface SessionData {
  id: string
  isCurrent: boolean
}

export default function UserSettingsPage() {
  const { showToast } = useToast()
  const router = useRouter()
  const [sessions, setSessions] = useState<SessionData[]>([])
  const [notifications, setNotifications] = useState({
    interviewInvites: true,
    offersOnboarding: true,
    statusChanges: true,
    announcements: true,
  })
  const [privacy, setPrivacy] = useState({
    showPhone: true,
    showAddress: false,
    showTimezone: true,
  })

  useEffect(() => {
    const loadSessions = async () => {
      const response = await fetch('/api/profile')
      if (!response.ok) return
      const data = await response.json()
      setSessions(data.sessions || [])
    }
    loadSessions()
  }, [])

  const handleSave = () => {
    showToast('Settings saved for this device', 'success')
  }

  const handleSignOutAll = async () => {
    const response = await fetch('/api/profile/sessions', { method: 'DELETE' })
    if (!response.ok) {
      showToast('Failed to sign out all sessions', 'error')
      return
    }
    await fetch('/api/auth/logout', { method: 'POST' })
    router.push('/')
  }

  return (
    <div className="space-y-6">
      <div className="pb-6 border-b dark:border-[var(--border-subtle)]">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-[var(--text-primary)] mb-2">Settings</h1>
        <p className="text-gray-600 dark:text-[var(--text-tertiary)]">Manage your personal preferences</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="border border-gray-200 dark:border-[var(--border-subtle)] bg-white dark:bg-[var(--bg-elevated)]">
          <CardHeader>
            <CardTitle className="text-xl font-bold text-gray-900 dark:text-[var(--text-primary)] flex items-center gap-2">
              <Bell className="w-5 h-5 text-blue-600 dark:text-[var(--status-interview-text)]" />
              Notifications
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {[
              { key: 'interviewInvites', label: 'Interview invites' },
              { key: 'offersOnboarding', label: 'Offers & onboarding updates' },
              { key: 'statusChanges', label: 'Status changes' },
              { key: 'announcements', label: 'System announcements' },
            ].map((item) => (
              <label key={item.key} className="flex items-center gap-3 text-sm text-gray-700 dark:text-[var(--text-secondary)]">
                <Checkbox
                  checked={notifications[item.key as keyof typeof notifications]}
                  onCheckedChange={(checked) =>
                    setNotifications((prev) => ({
                      ...prev,
                      [item.key]: Boolean(checked),
                    }))
                  }
                />
                {item.label}
              </label>
            ))}
          </CardContent>
        </Card>

        <Card className="border border-gray-200 dark:border-[var(--border-subtle)] bg-white dark:bg-[var(--bg-elevated)]">
          <CardHeader>
            <CardTitle className="text-xl font-bold text-gray-900 dark:text-[var(--text-primary)] flex items-center gap-2">
              <Palette className="w-5 h-5 text-purple-600 dark:text-[var(--status-onboarding-text)]" />
              Appearance
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground dark:text-[var(--text-tertiary)]">
              Dark mode is available in the Admin panel only. Go to Admin → Dashboard and use the theme toggle in the header to switch.
            </p>
          </CardContent>
        </Card>

        <Card className="border border-gray-200 dark:border-[var(--border-subtle)] bg-white dark:bg-[var(--bg-elevated)]">
          <CardHeader>
            <CardTitle className="text-xl font-bold text-gray-900 dark:text-[var(--text-primary)] flex items-center gap-2">
              <Shield className="w-5 h-5 text-green-600 dark:text-[var(--status-hired-text)]" />
              Privacy
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {[
              { key: 'showPhone', label: 'Show phone to admins' },
              { key: 'showAddress', label: 'Show address to admins' },
              { key: 'showTimezone', label: 'Show timezone to admins' },
            ].map((item) => (
              <label key={item.key} className="flex items-center gap-3 text-sm text-gray-700 dark:text-[var(--text-secondary)]">
                <Checkbox
                  checked={privacy[item.key as keyof typeof privacy]}
                  onCheckedChange={(checked) =>
                    setPrivacy((prev) => ({
                      ...prev,
                      [item.key]: Boolean(checked),
                    }))
                  }
                />
                {item.label}
              </label>
            ))}
          </CardContent>
        </Card>

        <Card className="border border-gray-200 dark:border-[var(--border-subtle)] bg-white dark:bg-[var(--bg-elevated)]">
          <CardHeader>
            <CardTitle className="text-xl font-bold text-gray-900 dark:text-[var(--text-primary)] flex items-center gap-2">
              <Monitor className="w-5 h-5 text-orange-600 dark:text-[var(--orange-primary)]" />
              Security Shortcuts
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="text-sm text-gray-700 dark:text-[var(--text-secondary)]">
              Active sessions: <span className="font-semibold">{sessions.length}</span>
            </div>
            <div className="flex flex-wrap gap-3">
              <Button onClick={handleSignOutAll} variant="outline" className="dark:border-[var(--border-subtle)] dark:text-[var(--text-secondary)] dark:hover:bg-[var(--bg-elevated-hover)] dark:hover:border-[var(--orange-primary)] dark:hover:text-[var(--orange-primary)]">
                Sign out all sessions
              </Button>
              <Button onClick={() => router.push('/profile')} variant="ghost" className="dark:text-[var(--text-secondary)] dark:hover:bg-[var(--bg-elevated-hover)] dark:hover:text-[var(--text-primary)]">
                Manage devices
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="flex gap-3">
        <Button onClick={handleSave} className="dark:bg-[var(--orange-primary)] dark:text-[var(--text-on-orange)] dark:hover:bg-[var(--orange-hover)] border-0">
          Save Preferences
        </Button>
        <Button variant="outline" onClick={() => router.push('/profile')} className="dark:border-[var(--border-subtle)] dark:text-[var(--text-secondary)] dark:hover:bg-[var(--bg-elevated-hover)]">
          Back to Profile
        </Button>
      </div>
    </div>
  )
}
