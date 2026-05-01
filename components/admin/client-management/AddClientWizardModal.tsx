'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
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
import AddressAutocomplete, { type StructuredAddress } from '@/components/ui/AddressAutocomplete'
import { useToast } from '@/components/ui/toast'
import { CRM_CLIENT_STATUSES } from '@/lib/crm-client/constants'

const STEPS = [
  'Basic info',
  'Location',
  'Guardian',
  'Insurance',
  'Preferences',
  'Review',
] as const

export default function AddClientWizardModal({
  open,
  onClose,
  onCreated,
}: {
  open: boolean
  onClose: () => void
  onCreated: () => void
}) {
  const router = useRouter()
  const { showToast } = useToast()
  const [step, setStep] = useState(0)
  const [submitting, setSubmitting] = useState(false)

  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [dateOfBirth, setDateOfBirth] = useState('')
  const [diagnosis, setDiagnosis] = useState('')
  const [status, setStatus] = useState('NEW_INTAKE')
  const [intakeDate, setIntakeDate] = useState(() => new Date().toISOString().slice(0, 10))

  const [addressLine1, setAddressLine1] = useState('')
  const [addressLine2, setAddressLine2] = useState('')
  const [city, setCity] = useState('')
  const [state, setState] = useState('')
  const [zipCode, setZipCode] = useState('')

  const [guardianName, setGuardianName] = useState('')
  const [guardianRelationship, setGuardianRelationship] = useState('')
  const [guardianPhone, setGuardianPhone] = useState('')
  const [guardianEmail, setGuardianEmail] = useState('')
  const [preferredLanguage, setPreferredLanguage] = useState('')

  const [insuranceProvider, setInsuranceProvider] = useState('')
  const [insuranceMemberId, setInsuranceMemberId] = useState('')
  const [insuranceGroupNumber, setInsuranceGroupNumber] = useState('')
  const [insurancePhone, setInsurancePhone] = useState('')
  const [authorizationNumber, setAuthorizationNumber] = useState('')
  const [authorizationStartDate, setAuthorizationStartDate] = useState('')
  const [authorizationEndDate, setAuthorizationEndDate] = useState('')
  const [authorizedHoursPerWeek, setAuthorizedHoursPerWeek] = useState('')

  const [preferredRbtGender, setPreferredRbtGender] = useState('')
  const [preferredRbtEthnicity, setPreferredRbtEthnicity] = useState('')
  const [notes, setNotes] = useState('')

  const reset = () => {
    setStep(0)
    setFirstName('')
    setLastName('')
    setDateOfBirth('')
    setDiagnosis('')
    setStatus('NEW_INTAKE')
    setIntakeDate(new Date().toISOString().slice(0, 10))
    setAddressLine1('')
    setAddressLine2('')
    setCity('')
    setState('')
    setZipCode('')
    setGuardianName('')
    setGuardianRelationship('')
    setGuardianPhone('')
    setGuardianEmail('')
    setPreferredLanguage('')
    setInsuranceProvider('')
    setInsuranceMemberId('')
    setInsuranceGroupNumber('')
    setInsurancePhone('')
    setAuthorizationNumber('')
    setAuthorizationStartDate('')
    setAuthorizationEndDate('')
    setAuthorizedHoursPerWeek('')
    setPreferredRbtGender('')
    setPreferredRbtEthnicity('')
    setNotes('')
  }

  const handleClose = () => {
    reset()
    onClose()
  }

  const onAddressSelect = (addr: StructuredAddress) => {
    setAddressLine1(addr.addressLine1)
    setAddressLine2(addr.addressLine2)
    setCity(addr.city)
    setState(addr.state)
    setZipCode(addr.zipCode)
  }

  const submit = async () => {
    setSubmitting(true)
    try {
      const body = {
        firstName,
        lastName,
        dateOfBirth: dateOfBirth || null,
        diagnosis: diagnosis || null,
        status,
        intakeDate,
        addressLine1: addressLine1 || null,
        addressLine2: addressLine2 || null,
        city: city || null,
        state: state || null,
        zipCode: zipCode || null,
        guardianName: guardianName || null,
        guardianRelationship: guardianRelationship || null,
        guardianPhone: guardianPhone || null,
        guardianEmail: guardianEmail || null,
        preferredLanguage: preferredLanguage || null,
        insuranceProvider: insuranceProvider || null,
        insuranceMemberId: insuranceMemberId || null,
        insuranceGroupNumber: insuranceGroupNumber || null,
        insurancePhone: insurancePhone || null,
        authorizationNumber: authorizationNumber || null,
        authorizationStartDate: authorizationStartDate || null,
        authorizationEndDate: authorizationEndDate || null,
        authorizedHoursPerWeek: authorizedHoursPerWeek ? Number(authorizedHoursPerWeek) : null,
        preferredRbtGender: preferredRbtGender || null,
        preferredRbtEthnicity: preferredRbtEthnicity || null,
        notes: notes || null,
      }
      const res = await fetch('/api/admin/clients', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || 'Failed to create client')
      showToast('Client created', 'success')
      onCreated()
      handleClose()
      if (data.id) router.push(`/admin/clients/${data.id}`)
    } catch (e) {
      showToast(`Error: ${String(e)}`, 'error')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && handleClose()}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Add client — step {step + 1} / {STEPS.length}: {STEPS[step]}</DialogTitle>
        </DialogHeader>

        {step === 0 && (
          <div className="space-y-3">
            <div>
              <Label>First name *</Label>
              <Input value={firstName} onChange={(e) => setFirstName(e.target.value)} />
            </div>
            <div>
              <Label>Last name *</Label>
              <Input value={lastName} onChange={(e) => setLastName(e.target.value)} />
            </div>
            <div>
              <Label>Date of birth</Label>
              <Input type="date" value={dateOfBirth} onChange={(e) => setDateOfBirth(e.target.value)} />
            </div>
            <div>
              <Label>Diagnosis</Label>
              <Input value={diagnosis} onChange={(e) => setDiagnosis(e.target.value)} />
            </div>
            <div>
              <Label>Initial status</Label>
              <Select value={status} onValueChange={setStatus}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CRM_CLIENT_STATUSES.map((s) => (
                    <SelectItem key={s} value={s}>
                      {s}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Intake date</Label>
              <Input type="date" value={intakeDate} onChange={(e) => setIntakeDate(e.target.value)} />
            </div>
          </div>
        )}

        {step === 1 && (
          <div className="space-y-3">
            <AddressAutocomplete onAddressSelect={onAddressSelect} label="Search address" />
            <div>
              <Label>Address line 1</Label>
              <Input value={addressLine1} onChange={(e) => setAddressLine1(e.target.value)} />
            </div>
            <div>
              <Label>City / State / ZIP</Label>
              <div className="grid grid-cols-3 gap-2">
                <Input placeholder="City" value={city} onChange={(e) => setCity(e.target.value)} />
                <Input placeholder="State" value={state} onChange={(e) => setState(e.target.value)} />
                <Input placeholder="ZIP" value={zipCode} onChange={(e) => setZipCode(e.target.value)} />
              </div>
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-3">
            <div>
              <Label>Guardian name</Label>
              <Input value={guardianName} onChange={(e) => setGuardianName(e.target.value)} />
            </div>
            <div>
              <Label>Relationship</Label>
              <Input value={guardianRelationship} onChange={(e) => setGuardianRelationship(e.target.value)} />
            </div>
            <div>
              <Label>Phone</Label>
              <Input value={guardianPhone} onChange={(e) => setGuardianPhone(e.target.value)} />
            </div>
            <div>
              <Label>Email</Label>
              <Input type="email" value={guardianEmail} onChange={(e) => setGuardianEmail(e.target.value)} />
            </div>
            <div>
              <Label>Preferred language</Label>
              <Input value={preferredLanguage} onChange={(e) => setPreferredLanguage(e.target.value)} />
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="space-y-3">
            <div>
              <Label>Insurance provider</Label>
              <Input value={insuranceProvider} onChange={(e) => setInsuranceProvider(e.target.value)} />
            </div>
            <div>
              <Label>Member ID</Label>
              <Input value={insuranceMemberId} onChange={(e) => setInsuranceMemberId(e.target.value)} />
            </div>
            <div>
              <Label>Group number</Label>
              <Input value={insuranceGroupNumber} onChange={(e) => setInsuranceGroupNumber(e.target.value)} />
            </div>
            <div>
              <Label>Insurance phone</Label>
              <Input value={insurancePhone} onChange={(e) => setInsurancePhone(e.target.value)} />
            </div>
            <div>
              <Label>Authorization number</Label>
              <Input value={authorizationNumber} onChange={(e) => setAuthorizationNumber(e.target.value)} />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label>Auth start</Label>
                <Input
                  type="date"
                  value={authorizationStartDate}
                  onChange={(e) => setAuthorizationStartDate(e.target.value)}
                />
              </div>
              <div>
                <Label>Auth end</Label>
                <Input
                  type="date"
                  value={authorizationEndDate}
                  onChange={(e) => setAuthorizationEndDate(e.target.value)}
                />
              </div>
            </div>
            <div>
              <Label>Authorized hours / week</Label>
              <Input
                type="number"
                value={authorizedHoursPerWeek}
                onChange={(e) => setAuthorizedHoursPerWeek(e.target.value)}
              />
            </div>
          </div>
        )}

        {step === 4 && (
          <div className="space-y-3">
            <div>
              <Label>Preferred RBT gender</Label>
              <Input value={preferredRbtGender} onChange={(e) => setPreferredRbtGender(e.target.value)} />
            </div>
            <div>
              <Label>Preferred RBT ethnicity</Label>
              <Input value={preferredRbtEthnicity} onChange={(e) => setPreferredRbtEthnicity(e.target.value)} />
            </div>
            <div>
              <Label>Notes</Label>
              <textarea
                className="w-full min-h-[100px] rounded-md border border-input bg-background px-3 py-2 text-sm"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
              />
            </div>
          </div>
        )}

        {step === 5 && (
          <div className="text-sm space-y-2 text-gray-700 dark:text-gray-300">
            <p>
              <strong>Name:</strong> {firstName} {lastName}
            </p>
            <p>
              <strong>Status:</strong> {status}
            </p>
            <p>
              <strong>Location:</strong> {[addressLine1, city, state, zipCode].filter(Boolean).join(', ') || '—'}
            </p>
            <p>
              <strong>Guardian:</strong> {guardianName || '—'}
            </p>
            <p>
              <strong>Insurance:</strong> {insuranceProvider || '—'}
            </p>
          </div>
        )}

        <DialogFooter className="gap-2">
          {step > 0 && (
            <Button type="button" variant="outline" onClick={() => setStep((s) => s - 1)}>
              Back
            </Button>
          )}
          {step < STEPS.length - 1 ? (
            <Button
              type="button"
              className="bg-orange-600 hover:bg-orange-700"
              disabled={step === 0 && (!firstName.trim() || !lastName.trim())}
              onClick={() => setStep((s) => s + 1)}
            >
              Next
            </Button>
          ) : (
            <Button
              type="button"
              className="bg-orange-600 hover:bg-orange-700"
              disabled={submitting || !firstName.trim() || !lastName.trim()}
              onClick={submit}
            >
              {submitting ? 'Saving…' : 'Add Client'}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
