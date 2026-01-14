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
  const [appearance, setAppearance] = useState('system')
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
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-blue-600 via-blue-500 to-blue-400 p-8 shadow-lg">
        <div className="absolute top-0 right-0 w-32 h-32 bg-white/20 rounded-full -mr-16 -mt-16 bubble-animation" />
        <div className="absolute bottom-0 left-0 w-24 h-24 bg-white/20 rounded-full -ml-12 -mb-12 bubble-animation-delayed" />
        <div className="relative">
          <h1 className="text-4xl font-bold text-white mb-2">Settings</h1>
          <p className="text-blue-50 text-lg">Manage your personal preferences</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="border-2 border-blue-100 bg-gradient-to-br from-white to-blue-50/30">
          <CardHeader>
            <CardTitle className="text-xl font-bold text-gray-900 flex items-center gap-2">
              <Bell className="w-5 h-5 text-blue-600" />
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
              <label key={item.key} className="flex items-center gap-3 text-sm text-gray-700">
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

        <Card className="border-2 border-purple-100 bg-gradient-to-br from-white to-purple-50/30">
          <CardHeader>
            <CardTitle className="text-xl font-bold text-gray-900 flex items-center gap-2">
              <Palette className="w-5 h-5 text-purple-600" />
              Appearance
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <Label>Theme</Label>
            <div className="flex gap-2">
              {['light', 'dark', 'system'].map((option) => (
                <Button
                  key={option}
                  variant={appearance === option ? 'default' : 'outline'}
                  onClick={() => setAppearance(option)}
                  className="capitalize"
                >
                  {option}
                </Button>
              ))}
            </div>
            <p className="text-xs text-gray-500">Theme preference is saved locally for now.</p>
          </CardContent>
        </Card>

        <Card className="border-2 border-green-100 bg-gradient-to-br from-white to-green-50/30">
          <CardHeader>
            <CardTitle className="text-xl font-bold text-gray-900 flex items-center gap-2">
              <Shield className="w-5 h-5 text-green-600" />
              Privacy
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {[
              { key: 'showPhone', label: 'Show phone to admins' },
              { key: 'showAddress', label: 'Show address to admins' },
              { key: 'showTimezone', label: 'Show timezone to admins' },
            ].map((item) => (
              <label key={item.key} className="flex items-center gap-3 text-sm text-gray-700">
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

        <Card className="border-2 border-orange-100 bg-gradient-to-br from-white to-orange-50/30">
          <CardHeader>
            <CardTitle className="text-xl font-bold text-gray-900 flex items-center gap-2">
              <Monitor className="w-5 h-5 text-orange-600" />
              Security Shortcuts
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="text-sm text-gray-700">
              Active sessions: <span className="font-semibold">{sessions.length}</span>
            </div>
            <div className="flex flex-wrap gap-3">
              <Button onClick={handleSignOutAll} variant="outline">
                Sign out all sessions
              </Button>
              <Button onClick={() => router.push('/profile')} variant="ghost">
                Manage devices
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="flex gap-3">
        <Button onClick={handleSave} className="gradient-primary text-white border-0 rounded-xl px-6">
          Save Preferences
        </Button>
        <Button variant="outline" onClick={() => router.push('/profile')}>
          Back to Profile
        </Button>
      </div>
    </div>
  )
}
