'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { useToast } from '@/components/ui/toast'
import {
  Mail,
  MapPin,
  Phone,
  Shield,
  UserCircle,
  Pencil,
  Save,
  XCircle,
  Palette,
} from 'lucide-react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useTheme } from '@/components/theme/ThemeProvider'
import SuperAdminActivityLogs from '@/components/admin/SuperAdminActivityLogs'
import SuperAdminUserManagement from '@/components/admin/SuperAdminUserManagement'
import SuperAdminCreateAdmin from '@/components/admin/SuperAdminCreateAdmin'

interface ProfileData {
  id?: string
  userId?: string
  fullName?: string | null
  preferredName?: string | null
  phone?: string | null
  address?: string | null
  timezone?: string | null
  preferredContactMethod?: 'EMAIL' | 'TEXT' | 'CALL' | null
  bio?: string | null
  skills?: string[]
  languages?: string[]
  emergencyContactName?: string | null
  emergencyContactRelationship?: string | null
  emergencyContactPhone?: string | null
  employeeId?: string | null
  startDate?: string | null
  department?: string | null
  title?: string | null
  rbtCertificationNumber?: string | null
  rbtCertificationExpiresAt?: string | null
}


interface UserData {
  id: string
  email: string | null
  phoneNumber: string | null
  role: 'ADMIN' | 'RBT' | 'CANDIDATE'
  isActive: boolean
}

export default function ProfilePage() {
  const router = useRouter()
  const { showToast } = useToast()
  const { theme, setTheme } = useTheme()

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [editing, setEditing] = useState(false)

  const [user, setUser] = useState<UserData | null>(null)
  const [profile, setProfile] = useState<ProfileData>({})
  const [originalProfile, setOriginalProfile] = useState<ProfileData>({})

  useEffect(() => {
    fetchProfile()
  }, [])

  const fetchProfile = async () => {
    try {
      setLoading(true)
      const response = await fetch('/api/profile')
      if (!response.ok) {
        showToast('Failed to load profile', 'error')
        return
      }
      const data = await response.json()
      setUser(data.user)
      const normalizedProfile = normalizeProfile(data.profile)
      setProfile(normalizedProfile)
      setOriginalProfile(normalizedProfile)
    } catch (error) {
      console.error('Error loading profile:', error)
      showToast('Failed to load profile', 'error')
    } finally {
      setLoading(false)
    }
  }

  const isDirty = useMemo(
    () => JSON.stringify(profile) !== JSON.stringify(originalProfile),
    [profile, originalProfile]
  )

  const roleLabel = user?.role === 'ADMIN' ? 'Admin' : user?.role === 'RBT' ? 'RBT' : 'User'
  const statusLabel = user?.isActive ? 'Active' : 'Inactive'
  const avatarFallback = getInitials(profile.fullName || user?.email || 'RS')

  const permissions = user?.role === 'ADMIN'
    ? [
        'Manage candidates',
        'Onboarding documents',
        'Scheduling',
        'Payroll exports',
        'System configuration',
      ]
    : [
        'View schedules',
        'Submit availability',
        'Upload onboarding documents',
        'Request leave',
        'View pay summaries',
      ]

  const handleSave = async () => {
    if (!isDirty) return
    try {
      setSaving(true)
      const response = await fetch('/api/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(profile),
      })
      if (!response.ok) {
        const data = await response.json()
        showToast(data.error || 'Failed to update profile', 'error')
        return
      }
      showToast('Profile updated successfully', 'success')
      setEditing(false)
      await fetchProfile()
    } catch (error) {
      console.error('Error updating profile:', error)
      showToast('Failed to update profile', 'error')
    } finally {
      setSaving(false)
    }
  }

  const handleCancel = () => {
    setProfile(originalProfile)
    setEditing(false)
  }


  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="text-gray-500 dark:text-[var(--text-tertiary)]">Loading profile...</div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <Card className="border-2 border-orange-100 dark:border-[var(--border-subtle)] bg-gradient-to-br from-white to-orange-50/30 dark:bg-[var(--bg-elevated)] relative overflow-hidden">
        <div className="absolute top-0 right-0 w-40 h-40 bg-orange-200/20 dark:bg-[var(--orange-subtle)] rounded-full -mr-20 -mt-20 bubble-animation dark:opacity-30" />
        <CardContent className="relative p-6 md:p-8">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-6">
            <div className="flex items-center gap-5">
              <div className="relative">
                <div className="w-24 h-24 rounded-full bg-gradient-to-br from-orange-200 to-orange-100 dark:bg-[var(--orange-subtle)] flex items-center justify-center text-2xl font-bold text-orange-700 dark:text-[var(--orange-primary)] border-2 border-white dark:border-[var(--border-subtle)] shadow">
                  {avatarFallback}
                </div>
                <div className="absolute bottom-0 right-0 bg-white dark:bg-[var(--bg-elevated)] rounded-full p-2 shadow">
                  <UserCircle className="w-4 h-4 text-gray-600 dark:text-[var(--text-tertiary)]" />
                </div>
              </div>
              <div>
                <div className="flex items-center gap-3">
                  <h1 className="text-3xl font-bold text-gray-900 dark:text-[var(--text-primary)]">
                    {profile.fullName || user?.email || 'Profile'}
                  </h1>
                  <Badge className="bg-white text-gray-800 border border-gray-200 dark:bg-[var(--bg-elevated)] dark:text-[var(--text-primary)] dark:border-[var(--border-subtle)]">
                    {roleLabel}
                  </Badge>
                </div>
                <div className="flex flex-wrap items-center gap-4 text-sm text-gray-600 dark:text-[var(--text-tertiary)] mt-2">
                  <span className="inline-flex items-center gap-2">
                    <Mail className="w-4 h-4 text-gray-400 dark:text-[var(--text-disabled)]" />
                    {user?.email || '—'}
                  </span>
                  <span className="inline-flex items-center gap-2">
                    <Phone className="w-4 h-4 text-gray-400 dark:text-[var(--text-disabled)]" />
                    {profile.phone || user?.phoneNumber || '—'}
                  </span>
                  <span className="inline-flex items-center gap-2">
                    <MapPin className="w-4 h-4 text-gray-400 dark:text-[var(--text-disabled)]" />
                    {profile.timezone || 'Timezone not set'}
                  </span>
                </div>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button
                onClick={() => setEditing(!editing)}
                className="gradient-primary text-white dark:bg-[var(--orange-primary)] dark:text-[var(--text-on-orange)] dark:hover:bg-[var(--orange-hover)] border-0 rounded-xl px-6"
              >
                <Pencil className="w-4 h-4 mr-2" />
                {editing ? 'Editing' : 'Edit Profile'}
              </Button>
              <Button
                variant="outline"
                onClick={() => router.push('/settings')}
                className="rounded-xl px-6 dark:border-[var(--border-subtle)] dark:text-[var(--text-secondary)]"
              >
                Settings
              </Button>
              {user?.role === 'ADMIN' && (
                <Button
                  variant="outline"
                  onClick={() => router.push('/admin/settings')}
                  className="rounded-xl px-6 dark:border-[var(--border-subtle)] dark:text-[var(--text-secondary)]"
                >
                  System Settings
                </Button>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Personal Info */}
      <Card className="border-2 border-gray-100 dark:border-[var(--border-subtle)] bg-white dark:bg-[var(--bg-elevated)]">
        <CardHeader>
          <CardTitle className="text-xl font-bold text-gray-900 dark:text-[var(--text-primary)]">Personal Info</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-2">
            <Label>Full Name</Label>
            <Input
              value={profile.fullName || ''}
              onChange={(e) => setProfile((prev) => ({ ...prev, fullName: e.target.value }))}
              disabled={!editing}
            />
          </div>
          <div className="space-y-2">
            <Label>Preferred Name</Label>
            <Input
              value={profile.preferredName || ''}
              onChange={(e) => setProfile((prev) => ({ ...prev, preferredName: e.target.value }))}
              disabled={!editing}
            />
          </div>
          <div className="space-y-2">
            <Label>Email</Label>
            <Input value={user?.email || ''} disabled />
          </div>
          <div className="space-y-2">
            <Label>Phone Number</Label>
            <Input
              value={profile.phone || ''}
              onChange={(e) => setProfile((prev) => ({ ...prev, phone: e.target.value }))}
              disabled={!editing}
            />
          </div>
          <div className="space-y-2 md:col-span-2">
            <Label>Address</Label>
            <Input
              value={profile.address || ''}
              onChange={(e) => setProfile((prev) => ({ ...prev, address: e.target.value }))}
              disabled={!editing}
            />
          </div>
          <div className="space-y-2">
            <Label>Timezone</Label>
            <Input
              value={profile.timezone || ''}
              onChange={(e) => setProfile((prev) => ({ ...prev, timezone: e.target.value }))}
              disabled={!editing}
              placeholder="America/New_York"
            />
          </div>
          <div className="space-y-2">
            <Label>Preferred Contact Method</Label>
            <select
              value={profile.preferredContactMethod || ''}
              onChange={(e) =>
                setProfile((prev) => ({
                  ...prev,
                  preferredContactMethod: e.target.value as ProfileData['preferredContactMethod'],
                }))
              }
              disabled={!editing}
              className="flex h-10 w-full rounded-md border border-input bg-background dark:bg-[var(--bg-input)] dark:border-[var(--border-subtle)] dark:text-[var(--text-secondary)] px-3 py-2 text-sm"
            >
              <option value="">Select</option>
              <option value="EMAIL">Email</option>
              <option value="TEXT">Text</option>
              <option value="CALL">Call</option>
            </select>
          </div>
        </CardContent>
      </Card>

      {/* Appearance */}
      <Card className="border-2 border-gray-100 dark:border-[var(--border-subtle)] bg-white dark:bg-[var(--bg-elevated)]">
        <CardHeader>
          <CardTitle className="text-xl font-bold text-gray-900 dark:text-[var(--text-primary)] flex items-center gap-2">
            <Palette className="w-5 h-5 text-primary dark:text-[var(--orange-primary)]" />
            Appearance
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap gap-2">
            {(['light', 'dark', 'system'] as const).map((option) => (
              <Button
                key={option}
                variant={theme === option ? 'default' : 'outline'}
                size="sm"
                onClick={async () => {
                  setTheme(option)
                  try {
                    await fetch('/api/profile', {
                      method: 'PATCH',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ themePreference: option }),
                    })
                  } catch {
                    // Theme is still applied locally
                  }
                }}
                className="capitalize"
              >
                {option}
              </Button>
            ))}
          </div>
          <p className="text-sm text-muted-foreground">
            <Link href="/settings" className="text-primary dark:text-[var(--orange-primary)] hover:underline">
              More settings
            </Link>
            {' '}→ Notification and privacy preferences
          </p>
        </CardContent>
      </Card>

      {/* Roles & Permissions */}
      <Card className="border-2 border-gray-100 dark:border-[var(--border-subtle)] bg-white dark:bg-[var(--bg-elevated)]">
        <CardHeader>
          <CardTitle className="text-xl font-bold text-gray-900 dark:text-[var(--text-primary)]">Roles & Permissions</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-3 mb-4">
            <Badge className="bg-primary text-white border-0 dark:bg-[var(--orange-primary)] dark:text-[var(--text-on-orange)]">{roleLabel}</Badge>
            <span className="text-sm text-gray-600 dark:text-[var(--text-tertiary)]">Access summary for your role</span>
          </div>
          <ul className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm text-gray-700 dark:text-[var(--text-secondary)]">
            {permissions.map((perm) => (
              <li key={perm} className="flex items-center gap-2">
                <Shield className="w-4 h-4 text-primary dark:text-[var(--orange-primary)]" />
                {perm}
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>

      {/* Super Admin Controls - Only visible to aaronsiam21@gmail.com */}
      {user?.email === 'aaronsiam21@gmail.com' && (
        <div className="space-y-6">
          <Card className="border-2 border-purple-200 dark:border-[var(--border-subtle)] bg-gradient-to-br from-white to-purple-50/30 dark:bg-[var(--bg-elevated)]">
            <CardHeader>
              <CardTitle className="text-2xl font-bold text-gray-900 dark:text-[var(--text-primary)] flex items-center gap-2">
                <Shield className="w-6 h-6 text-purple-600 dark:text-[var(--status-onboarding-text)]" />
                Super Admin Controls
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                <div className="lg:col-span-3">
                  <SuperAdminActivityLogs />
                </div>
                <div className="lg:col-span-2">
                  <SuperAdminUserManagement />
                </div>
                <div>
                  <SuperAdminCreateAdmin />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Edit Controls */}
      {editing && (
        <div className="flex flex-wrap gap-3">
          <Button
            onClick={handleSave}
            disabled={!isDirty || saving}
            className="gradient-primary text-white dark:bg-[var(--orange-primary)] dark:text-[var(--text-on-orange)] dark:hover:bg-[var(--orange-hover)] border-0 rounded-xl px-6"
          >
            <Save className="w-4 h-4 mr-2" />
            {saving ? 'Saving...' : 'Save Changes'}
          </Button>
          <Button variant="outline" onClick={handleCancel} disabled={saving} className="dark:border-[var(--border-subtle)] dark:text-[var(--text-secondary)]">
            <XCircle className="w-4 h-4 mr-2" />
            Cancel
          </Button>
        </div>
      )}
    </div>
  )
}

function normalizeProfile(profile: ProfileData | null): ProfileData {
  if (!profile) {
    return {
      skills: [],
      languages: [],
    }
  }

  return {
    ...profile,
    skills: profile.skills || [],
    languages: profile.languages || [],
    startDate: profile.startDate || null,
    rbtCertificationExpiresAt: profile.rbtCertificationExpiresAt || null,
  }
}

function getInitials(value: string): string {
  const parts = value.trim().split(' ')
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return `${parts[0][0]}${parts[1][0]}`.toUpperCase()
}

function parseCommaList(value: string): string[] {
  return value
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean)
}

