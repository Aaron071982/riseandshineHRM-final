'use client'

import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import AddressAutocomplete, { type StructuredAddress } from '@/components/ui/AddressAutocomplete'
import type { ApplicationData } from './types'

interface ApplicationStepPersonalInfoProps {
  data: ApplicationData
  setData: React.Dispatch<React.SetStateAction<ApplicationData>>
}

export default function ApplicationStepPersonalInfo({ data, setData }: ApplicationStepPersonalInfoProps) {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold mb-2 text-gray-900">Personal Information</h2>
        <p className="text-gray-600 leading-relaxed">Please provide your basic information.</p>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div>
          <Label htmlFor="firstName">First Name *</Label>
          <Input
            id="firstName"
            value={data.firstName}
            onChange={(e) => setData({ ...data, firstName: e.target.value })}
            required
          />
        </div>
        <div>
          <Label htmlFor="lastName">Last Name *</Label>
          <Input
            id="lastName"
            value={data.lastName}
            onChange={(e) => setData({ ...data, lastName: e.target.value })}
            required
          />
        </div>
        <div>
          <Label htmlFor="email">Email Address *</Label>
          <Input
            id="email"
            type="email"
            value={data.email}
            onChange={(e) => setData({ ...data, email: e.target.value })}
            required
          />
        </div>
        <div>
          <Label htmlFor="phoneNumber">Phone Number *</Label>
          <Input
            id="phoneNumber"
            type="tel"
            value={data.phoneNumber}
            onChange={(e) => setData({ ...data, phoneNumber: e.target.value })}
            placeholder="3473090431"
            required
          />
        </div>
        <div className="md:col-span-2">
          <AddressAutocomplete
            onAddressSelect={(address: StructuredAddress) =>
              setData({
                ...data,
                addressLine1: address.addressLine1,
                addressLine2: address.addressLine2 || '',
                city: address.city,
                state: address.state,
                zipCode: address.zipCode,
              })
            }
            placeholder="Search your address to auto-fill..."
            id="application-address-search"
            label="Search address (optional)"
          />
        </div>
        <div className="md:col-span-2">
          <Label htmlFor="addressLine1">Address Line 1 *</Label>
          <Input
            id="addressLine1"
            value={data.addressLine1}
            onChange={(e) => setData({ ...data, addressLine1: e.target.value })}
            required
          />
        </div>
        <div className="md:col-span-2">
          <Label htmlFor="addressLine2">Address Line 2</Label>
          <Input
            id="addressLine2"
            value={data.addressLine2}
            onChange={(e) => setData({ ...data, addressLine2: e.target.value })}
          />
        </div>
        <div>
          <Label htmlFor="city">City</Label>
          <Input id="city" value={data.city} onChange={(e) => setData({ ...data, city: e.target.value })} />
        </div>
        <div>
          <Label htmlFor="state">State</Label>
          <Input
            id="state"
            value={data.state}
            onChange={(e) => setData({ ...data, state: e.target.value })}
            maxLength={2}
            placeholder="NY"
          />
        </div>
        <div>
          <Label htmlFor="zipCode">Zip Code *</Label>
          <Input
            id="zipCode"
            value={data.zipCode}
            onChange={(e) => setData({ ...data, zipCode: e.target.value })}
            required
          />
        </div>
        <div>
          <Label htmlFor="gender">Gender *</Label>
          <Select value={data.gender} onValueChange={(value) => setData({ ...data, gender: value })} required>
            <SelectTrigger>
              <SelectValue placeholder="Select gender" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="Male">Male</SelectItem>
              <SelectItem value="Female">Female</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label htmlFor="ethnicity">Ethnicity *</Label>
          <Select value={data.ethnicity} onValueChange={(value) => setData({ ...data, ethnicity: value })} required>
            <SelectTrigger>
              <SelectValue placeholder="Select ethnicity" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="WHITE">White</SelectItem>
              <SelectItem value="ASIAN">Asian</SelectItem>
              <SelectItem value="BLACK">Black</SelectItem>
              <SelectItem value="HISPANIC">Hispanic</SelectItem>
              <SelectItem value="SOUTH_ASIAN">South Asian</SelectItem>
              <SelectItem value="MIDDLE_EASTERN">Middle Eastern</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
      <div className="hidden">
        <Label htmlFor="website">Website (leave blank)</Label>
        <Input
          id="website"
          type="text"
          value={data.website || ''}
          onChange={(e) => setData({ ...data, website: e.target.value })}
          tabIndex={-1}
          autoComplete="off"
        />
      </div>
    </div>
  )
}
