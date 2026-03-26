'use client'

import { useState, useMemo } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Loader2 } from 'lucide-react'
import AddressAutocomplete, { type StructuredAddress } from '@/components/ui/AddressAutocomplete'
import type { RBTProfile } from './types'

interface EditProfileFormProps {
  rbtProfile: RBTProfile
  onCancel: () => void
  onSuccess: (updatedProfile?: Partial<RBTProfile> | null) => void
}

function buildDefaultAddress(p: RBTProfile): string {
  return [p.addressLine1, p.locationCity, p.locationState, p.zipCode].filter(Boolean).join(', ')
}

export default function EditProfileForm({ rbtProfile, onCancel, onSuccess }: EditProfileFormProps) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [locationCity, setLocationCity] = useState(rbtProfile.locationCity ?? '')
  const [locationState, setLocationState] = useState(rbtProfile.locationState ?? '')
  const [zipCode, setZipCode] = useState(rbtProfile.zipCode ?? '')
  const [addressLine1, setAddressLine1] = useState(rbtProfile.addressLine1 ?? '')
  const [addressLine2, setAddressLine2] = useState(rbtProfile.addressLine2 ?? '')

  const addressDefaultValue = useMemo(() => buildDefaultAddress(rbtProfile), [rbtProfile])

  const handleAddressSelect = (address: StructuredAddress) => {
    setAddressLine1(address.addressLine1)
    setAddressLine2(address.addressLine2 || '')
    setLocationCity(address.city)
    setLocationState(address.state)
    setZipCode(address.zipCode)
  }

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    const formData = new FormData(e.currentTarget)
    const data = {
      firstName: formData.get('firstName'),
      lastName: formData.get('lastName'),
      phoneNumber: formData.get('phoneNumber'),
      email: formData.get('email') || null,
      locationCity: formData.get('locationCity') || null,
      locationState: formData.get('locationState') || null,
      zipCode: formData.get('zipCode') || null,
      addressLine1: formData.get('addressLine1') || null,
      addressLine2: formData.get('addressLine2') || null,
      preferredServiceArea: formData.get('preferredServiceArea') || null,
      notes: formData.get('notes') || null,
      gender: (formData.get('gender') as string | null) || null,
      ethnicity: (() => {
        const v = formData.get('ethnicity') as string | null
        if (!v || v === '__none__') return null
        return v
      })(),
      fortyHourCourseCompleted: (formData.get('fortyHourCourseCompleted') as string) === 'true',
    }

    try {
      const response = await fetch(`/api/admin/rbts/${rbtProfile.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
        credentials: 'include',
      })

      if (!response.ok) {
        const result = await response.json()
        throw new Error((result as { error?: string }).error || 'Failed to update profile')
      }
      const result = await response.json().catch(() => ({}))
      onSuccess((result as { profile?: unknown })?.profile as any)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to update profile')
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="space-y-2">
          <Label htmlFor="edit-firstName">First Name *</Label>
          <Input id="edit-firstName" name="firstName" defaultValue={rbtProfile.firstName} required />
        </div>
        <div className="space-y-2">
          <Label htmlFor="edit-lastName">Last Name *</Label>
          <Input id="edit-lastName" name="lastName" defaultValue={rbtProfile.lastName} required />
        </div>
        <div className="space-y-2">
          <Label htmlFor="edit-phoneNumber">Phone Number *</Label>
          <Input id="edit-phoneNumber" name="phoneNumber" type="tel" defaultValue={rbtProfile.phoneNumber} required />
        </div>
        <div className="space-y-2">
          <Label htmlFor="edit-email">Email</Label>
          <Input id="edit-email" name="email" type="email" defaultValue={rbtProfile.email || ''} />
        </div>
        <div className="space-y-2 md:col-span-2">
          <AddressAutocomplete
            onAddressSelect={handleAddressSelect}
            defaultValue={addressDefaultValue}
            placeholder="Search address to auto-fill..."
            id="edit-address-search"
            label="Search address (optional)"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="edit-locationCity">City</Label>
          <Input id="edit-locationCity" name="locationCity" value={locationCity} onChange={(e) => setLocationCity(e.target.value)} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="edit-locationState">State</Label>
          <Input id="edit-locationState" name="locationState" maxLength={2} placeholder="NY" value={locationState} onChange={(e) => setLocationState(e.target.value)} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="edit-zipCode">Zip Code *</Label>
          <Input id="edit-zipCode" name="zipCode" value={zipCode} onChange={(e) => setZipCode(e.target.value)} required />
        </div>
        <div className="space-y-2">
          <Label htmlFor="edit-preferredServiceArea">Preferred Service Area</Label>
          <Input id="edit-preferredServiceArea" name="preferredServiceArea" defaultValue={rbtProfile.preferredServiceArea || ''} />
        </div>
        <div className="space-y-2 md:col-span-2">
          <Label htmlFor="edit-addressLine1">Address Line 1 *</Label>
          <Input id="edit-addressLine1" name="addressLine1" value={addressLine1} onChange={(e) => setAddressLine1(e.target.value)} required />
        </div>
        <div className="space-y-2 md:col-span-2">
          <Label htmlFor="edit-addressLine2">Address Line 2</Label>
          <Input id="edit-addressLine2" name="addressLine2" value={addressLine2} onChange={(e) => setAddressLine2(e.target.value)} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="edit-gender">Gender</Label>
          <Select name="gender" defaultValue={rbtProfile.gender || 'Male'}>
            <SelectTrigger id="edit-gender">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="Male">Male</SelectItem>
              <SelectItem value="Female">Female</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="edit-ethnicity">Ethnicity</Label>
          <Select name="ethnicity" defaultValue={rbtProfile.ethnicity || '__none__'}>
            <SelectTrigger id="edit-ethnicity">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__none__">— None —</SelectItem>
              <SelectItem value="WHITE">White</SelectItem>
              <SelectItem value="ASIAN">Asian</SelectItem>
              <SelectItem value="BLACK">Black</SelectItem>
              <SelectItem value="HISPANIC">Hispanic</SelectItem>
              <SelectItem value="SOUTH_ASIAN">South Asian</SelectItem>
              <SelectItem value="MIDDLE_EASTERN">Middle Eastern</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="edit-fortyHourCourseCompleted">40-Hour RBT Course Already Completed</Label>
          <Select name="fortyHourCourseCompleted" defaultValue={rbtProfile.fortyHourCourseCompleted ? 'true' : 'false'}>
            <SelectTrigger id="edit-fortyHourCourseCompleted">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="false">No</SelectItem>
              <SelectItem value="true">Yes</SelectItem>
            </SelectContent>
          </Select>
          <p className="text-sm text-gray-500">
            If &quot;No&quot;, the RBT will need to complete the 40-hour course and upload certificate during onboarding.
          </p>
        </div>
        <div className="space-y-2 md:col-span-2">
          <Label htmlFor="edit-notes">Notes</Label>
          <textarea
            id="edit-notes"
            name="notes"
            rows={4}
            defaultValue={rbtProfile.notes || ''}
            className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
          />
        </div>
      </div>

      {error && (
        <div className="text-sm text-destructive bg-destructive/10 p-3 rounded-md">
          {error}
        </div>
      )}

      <div className="flex gap-4">
        <Button type="submit" disabled={loading}>
          {loading ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Saving...
            </>
          ) : (
            'Save Changes'
          )}
        </Button>
        <Button type="button" variant="outline" onClick={onCancel} disabled={loading}>
          Cancel
        </Button>
      </div>
    </form>
  )
}
