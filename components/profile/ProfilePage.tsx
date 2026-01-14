'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import Image from 'next/image'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Badge } from '@/components/ui/badge'
import { useToast } from '@/components/ui/toast'
import {
  Camera,
  Mail,
  MapPin,
  Phone,
  Shield,
  UserCircle,
  Pencil,
  Save,
  XCircle,
  Monitor,
  LogOut,
} from 'lucide-react'
import { useRouter } from 'next/navigation'

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
  profileImageUrl?: string | null
  employeeId?: string | null
  startDate?: string | null
  department?: string | null
  title?: string | null
  rbtCertificationNumber?: string | null
  rbtCertificationExpiresAt?: string | null
}

interface SessionData {
  id: string
  device: string | null
  browser: string | null
  ipAddress: string | null
  lastActiveAt: string | null
  createdAt: string
  expiresAt: string
  isCurrent: boolean
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
  const securityRef = useRef<HTMLDivElement | null>(null)

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [editing, setEditing] = useState(false)
  const [photoDialogOpen, setPhotoDialogOpen] = useState(false)
  const [photoUploading, setPhotoUploading] = useState(false)
  const [photoPreview, setPhotoPreview] = useState<string | null>(null)
  const [photoFile, setPhotoFile] = useState<File | null>(null)

  const [user, setUser] = useState<UserData | null>(null)
  const [profile, setProfile] = useState<ProfileData>({})
  const [originalProfile, setOriginalProfile] = useState<ProfileData>({})
  const [sessions, setSessions] = useState<SessionData[]>([])

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
      setSessions(data.sessions || [])
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

  const handlePhotoSelect = (file: File) => {
    const allowedTypes = ['image/png', 'image/jpeg', 'image/webp']
    if (!allowedTypes.includes(file.type)) {
      showToast('Please upload a PNG, JPG, or WEBP image', 'error')
      return
    }
    if (file.size > 5 * 1024 * 1024) {
      showToast('Image size must be under 5MB', 'error')
      return
    }

    setPhotoFile(file)
    setPhotoPreview(URL.createObjectURL(file))
  }

  const handlePhotoUpload = async () => {
    if (!photoFile) {
      showToast('Please select a photo first', 'warning')
      return
    }
    try {
      setPhotoUploading(true)
      const croppedFile = await cropToSquare(photoFile)
      const formData = new FormData()
      formData.append('file', croppedFile)
      const response = await fetch('/api/profile/photo', {
        method: 'POST',
        body: formData,
      })
      if (!response.ok) {
        const data = await response.json()
        showToast(data.error || 'Failed to upload photo', 'error')
        return
      }
      const data = await response.json()
      setProfile((prev) => ({ ...prev, profileImageUrl: data.profileImageUrl }))
      setPhotoDialogOpen(false)
      showToast('Photo updated successfully', 'success')
    } catch (error) {
      console.error('Error uploading photo:', error)
      showToast('Failed to upload photo', 'error')
    } finally {
      setPhotoUploading(false)
    }
  }

  const handleSignOutAll = async () => {
    try {
      const response = await fetch('/api/profile/sessions', { method: 'DELETE' })
      if (!response.ok) {
        showToast('Failed to sign out all sessions', 'error')
        return
      }
      await fetch('/api/auth/logout', { method: 'POST' })
      router.push('/')
    } catch (error) {
      console.error('Error signing out all sessions:', error)
      showToast('Failed to sign out all sessions', 'error')
    }
  }

  const handleSignOutSession = async (sessionId: string, isCurrent: boolean) => {
    try {
      if (isCurrent) {
        await fetch('/api/auth/logout', { method: 'POST' })
        router.push('/')
        return
      }
      const response = await fetch(`/api/profile/sessions/${sessionId}`, { method: 'DELETE' })
      if (!response.ok) {
        showToast('Failed to sign out session', 'error')
        return
      }
      await fetchProfile()
    } catch (error) {
      console.error('Error signing out session:', error)
      showToast('Failed to sign out session', 'error')
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="text-gray-500">Loading profile...</div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <Card className="border-2 border-orange-100 bg-gradient-to-br from-white to-orange-50/30 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-40 h-40 bg-orange-200/20 rounded-full -mr-20 -mt-20 bubble-animation" />
        <CardContent className="relative p-6 md:p-8">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-6">
            <div className="flex items-center gap-5">
              <div className="relative">
                {profile.profileImageUrl ? (
                  <Image
                    src={profile.profileImageUrl}
                    alt="Profile photo"
                    width={96}
                    height={96}
                    className="w-24 h-24 rounded-full object-cover border-2 border-white shadow"
                  />
                ) : (
                  <div className="w-24 h-24 rounded-full bg-gradient-to-br from-orange-200 to-orange-100 flex items-center justify-center text-2xl font-bold text-orange-700 border-2 border-white shadow">
                    {avatarFallback}
                  </div>
                )}
                <div className="absolute bottom-0 right-0 bg-white rounded-full p-2 shadow">
                  <UserCircle className="w-4 h-4 text-gray-600" />
                </div>
              </div>
              <div>
                <div className="flex items-center gap-3">
                  <h1 className="text-3xl font-bold text-gray-900">
                    {profile.fullName || user?.email || 'Profile'}
                  </h1>
                  <Badge className="bg-white text-gray-800 border border-gray-200">
                    {roleLabel}
                  </Badge>
                </div>
                <div className="flex flex-wrap items-center gap-4 text-sm text-gray-600 mt-2">
                  <span className="inline-flex items-center gap-2">
                    <Mail className="w-4 h-4 text-gray-400" />
                    {user?.email || '—'}
                  </span>
                  <span className="inline-flex items-center gap-2">
                    <Phone className="w-4 h-4 text-gray-400" />
                    {profile.phone || user?.phoneNumber || '—'}
                  </span>
                  <span className="inline-flex items-center gap-2">
                    <MapPin className="w-4 h-4 text-gray-400" />
                    {profile.timezone || 'Timezone not set'}
                  </span>
                </div>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button
                onClick={() => setEditing(!editing)}
                className="gradient-primary text-white border-0 rounded-xl px-6"
              >
                <Pencil className="w-4 h-4 mr-2" />
                {editing ? 'Editing' : 'Edit Profile'}
              </Button>
              {user?.role === 'ADMIN' && (
                <Button
                  variant="outline"
                  onClick={() => router.push('/admin/settings')}
                  className="rounded-xl px-6"
                >
                  System Settings
                </Button>
              )}
              <Dialog open={photoDialogOpen} onOpenChange={setPhotoDialogOpen}>
                <DialogTrigger asChild>
                  <Button variant="outline" className="rounded-xl px-6">
                    <Camera className="w-4 h-4 mr-2" />
                    Change Photo
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Update Profile Photo</DialogTitle>
                    <DialogDescription>
                      Upload a new photo (PNG, JPG, WEBP). We will auto-crop it to a square.
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4">
                    <Input
                      type="file"
                      accept="image/png,image/jpeg,image/webp"
                      onChange={(e) => {
                        const file = e.target.files?.[0]
                        if (file) handlePhotoSelect(file)
                      }}
                    />
                    {photoPreview && (
                      <div className="flex justify-center">
                        <Image
                          src={photoPreview}
                          alt="Preview"
                          width={140}
                          height={140}
                          className="rounded-full object-cover border"
                        />
                      </div>
                    )}
                  </div>
                  <DialogFooter>
                    <Button
                      variant="outline"
                      onClick={() => setPhotoDialogOpen(false)}
                      disabled={photoUploading}
                    >
                      Cancel
                    </Button>
                    <Button onClick={handlePhotoUpload} disabled={photoUploading}>
                      {photoUploading ? 'Uploading...' : 'Save Photo'}
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
              <Button
                variant="ghost"
                onClick={() => securityRef.current?.scrollIntoView({ behavior: 'smooth' })}
                className="rounded-xl"
              >
                <Shield className="w-4 h-4 mr-2" />
                Security & Login
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Personal Info */}
      <Card className="border-2 border-gray-100 bg-white">
        <CardHeader>
          <CardTitle className="text-xl font-bold text-gray-900">Personal Info</CardTitle>
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
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            >
              <option value="">Select</option>
              <option value="EMAIL">Email</option>
              <option value="TEXT">Text</option>
              <option value="CALL">Call</option>
            </select>
          </div>
        </CardContent>
      </Card>

      {/* Work Info */}
      <Card className="border-2 border-gray-100 bg-white">
        <CardHeader>
          <CardTitle className="text-xl font-bold text-gray-900">Work Info</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-2">
            <Label>Role</Label>
            <Input value={roleLabel} disabled />
          </div>
          <div className="space-y-2">
            <Label>Status</Label>
            <Input value={statusLabel} disabled />
          </div>
          <div className="space-y-2">
            <Label>Employee ID</Label>
            <Input
              value={profile.employeeId || ''}
              onChange={(e) => setProfile((prev) => ({ ...prev, employeeId: e.target.value }))}
              disabled={!editing}
            />
          </div>
          <div className="space-y-2">
            <Label>Start Date</Label>
            <Input
              type="date"
              value={profile.startDate ? profile.startDate.slice(0, 10) : ''}
              onChange={(e) => setProfile((prev) => ({ ...prev, startDate: e.target.value }))}
              disabled={!editing}
            />
          </div>

          {user?.role === 'RBT' ? (
            <>
              <div className="space-y-2">
                <Label>RBT Certification #</Label>
                <Input
                  value={profile.rbtCertificationNumber || ''}
                  onChange={(e) =>
                    setProfile((prev) => ({ ...prev, rbtCertificationNumber: e.target.value }))
                  }
                  disabled={!editing}
                />
              </div>
              <div className="space-y-2">
                <Label>Certification Expiration</Label>
                <Input
                  type="date"
                  value={
                    profile.rbtCertificationExpiresAt
                      ? profile.rbtCertificationExpiresAt.slice(0, 10)
                      : ''
                  }
                  onChange={(e) =>
                    setProfile((prev) => ({ ...prev, rbtCertificationExpiresAt: e.target.value }))
                  }
                  disabled={!editing}
                />
              </div>
            </>
          ) : (
            <>
              <div className="space-y-2">
                <Label>Department</Label>
                <Input
                  value={profile.department || ''}
                  onChange={(e) => setProfile((prev) => ({ ...prev, department: e.target.value }))}
                  disabled={!editing}
                />
              </div>
              <div className="space-y-2">
                <Label>Title</Label>
                <Input
                  value={profile.title || ''}
                  onChange={(e) => setProfile((prev) => ({ ...prev, title: e.target.value }))}
                  disabled={!editing}
                />
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Bio / Notes */}
      <Card className="border-2 border-gray-100 bg-white">
        <CardHeader>
          <CardTitle className="text-xl font-bold text-gray-900">Bio & Notes</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-2">
            <Label>Short Bio / About</Label>
            <Textarea
              value={profile.bio || ''}
              onChange={(e) => setProfile((prev) => ({ ...prev, bio: e.target.value }))}
              disabled={!editing}
              rows={4}
            />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <Label>Skills (comma-separated)</Label>
              <Input
                value={(profile.skills || []).join(', ')}
                onChange={(e) =>
                  setProfile((prev) => ({ ...prev, skills: parseCommaList(e.target.value) }))
                }
                disabled={!editing}
              />
            </div>
            <div className="space-y-2">
              <Label>Languages (comma-separated)</Label>
              <Input
                value={(profile.languages || []).join(', ')}
                onChange={(e) =>
                  setProfile((prev) => ({ ...prev, languages: parseCommaList(e.target.value) }))
                }
                disabled={!editing}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Emergency Contact */}
      <Card className="border-2 border-gray-100 bg-white">
        <CardHeader>
          <CardTitle className="text-xl font-bold text-gray-900">Emergency Contact</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-2">
            <Label>Name</Label>
            <Input
              value={profile.emergencyContactName || ''}
              onChange={(e) =>
                setProfile((prev) => ({ ...prev, emergencyContactName: e.target.value }))
              }
              disabled={!editing}
            />
          </div>
          <div className="space-y-2">
            <Label>Relationship</Label>
            <Input
              value={profile.emergencyContactRelationship || ''}
              onChange={(e) =>
                setProfile((prev) => ({ ...prev, emergencyContactRelationship: e.target.value }))
              }
              disabled={!editing}
            />
          </div>
          <div className="space-y-2">
            <Label>Phone</Label>
            <Input
              value={profile.emergencyContactPhone || ''}
              onChange={(e) =>
                setProfile((prev) => ({ ...prev, emergencyContactPhone: e.target.value }))
              }
              disabled={!editing}
            />
          </div>
        </CardContent>
      </Card>

      {/* Roles & Permissions */}
      <Card className="border-2 border-gray-100 bg-white">
        <CardHeader>
          <CardTitle className="text-xl font-bold text-gray-900">Roles & Permissions</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-3 mb-4">
            <Badge className="bg-primary text-white border-0">{roleLabel}</Badge>
            <span className="text-sm text-gray-600">Access summary for your role</span>
          </div>
          <ul className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm text-gray-700">
            {permissions.map((perm) => (
              <li key={perm} className="flex items-center gap-2">
                <Shield className="w-4 h-4 text-primary" />
                {perm}
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>

      {/* Security & Login */}
      <Card ref={securityRef} className="border-2 border-gray-100 bg-white">
        <CardHeader>
          <CardTitle className="text-xl font-bold text-gray-900">Security & Login</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <Label>Authentication Method</Label>
              <Input value="Email OTP" disabled />
            </div>
            <div className="space-y-2">
              <Label>Session Duration</Label>
              <Input value="30 days" disabled />
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label>Change Email</Label>
              <Input value="Email change is managed by HR" disabled />
              <p className="text-xs text-gray-500">Contact HR if you need to update your login email.</p>
            </div>
          </div>

          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-gray-900">Active Sessions</h3>
              <Button variant="outline" onClick={handleSignOutAll}>
                Sign out all sessions
              </Button>
            </div>
            <div className="space-y-3">
              {sessions.length === 0 ? (
                <p className="text-sm text-gray-500">No active sessions found.</p>
              ) : (
                sessions.map((session) => (
                  <div
                    key={session.id}
                    className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 border rounded-lg p-4"
                  >
                    <div className="flex items-center gap-3">
                      <Monitor className="w-5 h-5 text-gray-400" />
                      <div>
                        <p className="text-sm font-medium text-gray-900">
                          {session.browser || 'Browser'} on {session.device || 'Device'}
                          {session.isCurrent ? ' (Current session)' : ''}
                        </p>
                        <p className="text-xs text-gray-500">
                          Last active: {session.lastActiveAt ? new Date(session.lastActiveAt).toLocaleString() : '—'}
                        </p>
                        {session.ipAddress && (
                          <p className="text-xs text-gray-500">IP: {session.ipAddress}</p>
                        )}
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      className="text-red-600 hover:text-red-700"
                      onClick={() => handleSignOutSession(session.id, session.isCurrent)}
                    >
                      <LogOut className="w-4 h-4 mr-2" />
                      Sign out
                    </Button>
                  </div>
                ))
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Edit Controls */}
      {editing && (
        <div className="flex flex-wrap gap-3">
          <Button
            onClick={handleSave}
            disabled={!isDirty || saving}
            className="gradient-primary text-white border-0 rounded-xl px-6"
          >
            <Save className="w-4 h-4 mr-2" />
            {saving ? 'Saving...' : 'Save Changes'}
          </Button>
          <Button variant="outline" onClick={handleCancel} disabled={saving}>
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

async function cropToSquare(file: File): Promise<File> {
  const image = await loadImage(file)
  const size = Math.min(image.width, image.height)
  const startX = (image.width - size) / 2
  const startY = (image.height - size) / 2
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext('2d')
  if (!ctx) return file
  ctx.drawImage(image, startX, startY, size, size, 0, 0, size, size)
  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, 'image/webp', 0.9)
  )
  if (!blob) return file
  return new File([blob], file.name.replace(/\.\w+$/, '.webp'), { type: 'image/webp' })
}

function loadImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = reject
    img.src = URL.createObjectURL(file)
  })
}
