'use client'

import { useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { X, FileText, Upload, Loader2 } from 'lucide-react'
import AddressAutocomplete, { type StructuredAddress } from '@/components/ui/AddressAutocomplete'

interface DocumentFile {
  file: File
  documentType: string
}

export default function AddRBTForm() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [documents, setDocuments] = useState<DocumentFile[]>([])
  const [confirmDialogOpen, setConfirmDialogOpen] = useState(false)
  const [confirmLoading, setConfirmLoading] = useState(false)
  const [pendingFormData, setPendingFormData] = useState<FormData | null>(null)
  const [pendingIsHireDirect, setPendingIsHireDirect] = useState(false)
  // Address from autocomplete or manual entry (standardized when using autocomplete)
  const [addressLine1, setAddressLine1] = useState('')
  const [addressLine2, setAddressLine2] = useState('')
  const [locationCity, setLocationCity] = useState('')
  const [locationState, setLocationState] = useState('')
  const [zipCode, setZipCode] = useState('')

  const handleAddressSelect = useCallback((address: StructuredAddress) => {
    setAddressLine1(address.addressLine1)
    setAddressLine2(address.addressLine2 || '')
    setLocationCity(address.city)
    setLocationState(address.state)
    setZipCode(address.zipCode)
  }, [])

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || [])
    const newDocuments = files.map((file) => ({
      file,
      documentType: 'OTHER',
    }))
    setDocuments([...documents, ...newDocuments])
  }

  const removeDocument = (index: number) => {
    setDocuments(documents.filter((_, i) => i !== index))
  }

  const updateDocumentType = (index: number, documentType: string) => {
    const updated = [...documents]
    updated[index].documentType = documentType
    setDocuments(updated)
  }

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setError('')

    const formData = new FormData(e.currentTarget)
    if (!formData.get('authorizedToWork') || !formData.get('canPassBackgroundCheck') || !formData.get('cprFirstAidCertified')) {
      setError('Please answer all Compliance & Eligibility questions.')
      return
    }
    if (!formData.get('ethnicity')) {
      setError('Please select Ethnicity.')
      return
    }
    
    // Create FormData for file upload (use state for address so autocomplete-filled values are used)
    const submitData = new FormData()
    submitData.append('firstName', formData.get('firstName') as string)
    submitData.append('lastName', formData.get('lastName') as string)
    submitData.append('phoneNumber', formData.get('phoneNumber') as string)
    submitData.append('email', (formData.get('email') as string) || '')
    submitData.append('locationCity', locationCity)
    submitData.append('locationState', locationState)
    submitData.append('zipCode', zipCode)
    submitData.append('addressLine1', addressLine1)
    submitData.append('addressLine2', addressLine2 || '')
    submitData.append('preferredServiceArea', (formData.get('preferredServiceArea') as string) || '')
    submitData.append('notes', (formData.get('notes') as string) || '')
    submitData.append('gender', formData.get('gender') as string)
    submitData.append('ethnicity', formData.get('ethnicity') as string)
    submitData.append('status', formData.get('status') as string)
    submitData.append('fortyHourCourseCompleted', formData.get('fortyHourCourseCompleted') === 'true' ? 'true' : 'false')
    submitData.append('authorizedToWork', formData.get('authorizedToWork') as string)
    submitData.append('canPassBackgroundCheck', formData.get('canPassBackgroundCheck') as string)
    submitData.append('cprFirstAidCertified', formData.get('cprFirstAidCertified') as string)

    // Add documents
    documents.forEach((doc, index) => {
      submitData.append(`documents`, doc.file)
      submitData.append(`documentTypes`, doc.documentType)
    })

    const selectedStatus = (formData.get('status') as string) || 'NEW'
    const isHireDirect = selectedStatus === 'HIRED'

    setPendingFormData(submitData)
    setPendingIsHireDirect(isHireDirect)
    setConfirmDialogOpen(true)
  }

  const handleConfirmSubmit = async () => {
    if (!pendingFormData) return

    setConfirmLoading(true)
    setError('')

    try {
      const response = await fetch('/api/admin/rbts', {
        method: 'POST',
        body: pendingFormData,
        credentials: 'include',
      })

      const result = await response.json()

      if (!response.ok) {
        setError(result.error || 'Failed to create candidate')
        setConfirmLoading(false)
        // Keep dialog open on error so user can see the error message
        return
      }

      setConfirmDialogOpen(false)
      setPendingFormData(null)
      setPendingIsHireDirect(false)
      router.push(`/admin/rbts/${result.id}`)
    } catch (err) {
      setError('An error occurred. Please try again.')
      setConfirmLoading(false)
      // Keep dialog open on error so user can see the error message
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Candidate Information</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <Label htmlFor="firstName">First Name *</Label>
              <Input id="firstName" name="firstName" required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="lastName">Last Name *</Label>
              <Input id="lastName" name="lastName" required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="phoneNumber">Phone Number *</Label>
              <Input
                id="phoneNumber"
                name="phoneNumber"
                type="tel"
                placeholder="3473090431"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">Email *</Label>
              <Input id="email" name="email" type="email" required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="gender">Gender *</Label>
              <Select name="gender" required defaultValue="Male">
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Male">Male</SelectItem>
                  <SelectItem value="Female">Female</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="ethnicity">Ethnicity *</Label>
              <Select name="ethnicity" required>
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
            <div className="space-y-2">
              <Label htmlFor="status">Initial Status *</Label>
              <Select name="status" required defaultValue="NEW">
                <SelectTrigger>
                  <SelectValue placeholder="Select status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="NEW">New</SelectItem>
                  <SelectItem value="REACH_OUT">Reach Out</SelectItem>
                  <SelectItem value="TO_INTERVIEW">To Interview</SelectItem>
                  <SelectItem value="HIRED">Hired (no interview)</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Choose &quot;Hired (no interview)&quot; to add them as an active RBT with no interview step.
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="fortyHourCourseCompleted">40-Hour RBT Course Already Completed *</Label>
              <Select name="fortyHourCourseCompleted" required defaultValue="false">
                <SelectTrigger>
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
            {/* Location & Address — search autofills line address (no map loaded) */}
            <div className="md:col-span-2 space-y-2">
              <p className="text-sm font-medium text-muted-foreground">Location &amp; Address</p>
              <AddressAutocomplete
                onAddressSelect={handleAddressSelect}
                placeholder="Search address to auto-fill below..."
                id="address-search"
                label="Search address (optional)"
                className="mb-4"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="addressLine1">Address Line 1 *</Label>
              <Input
                id="addressLine1"
                name="addressLine1"
                value={addressLine1}
                onChange={(e) => setAddressLine1(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="addressLine2">Address Line 2</Label>
              <Input
                id="addressLine2"
                name="addressLine2"
                value={addressLine2}
                onChange={(e) => setAddressLine2(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="locationCity">City *</Label>
              <Input
                id="locationCity"
                name="locationCity"
                value={locationCity}
                onChange={(e) => setLocationCity(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="locationState">State *</Label>
              <Input
                id="locationState"
                name="locationState"
                value={locationState}
                onChange={(e) => setLocationState(e.target.value)}
                maxLength={2}
                placeholder="NY"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="zipCode">Zip Code *</Label>
              <Input
                id="zipCode"
                name="zipCode"
                value={zipCode}
                onChange={(e) => setZipCode(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="preferredServiceArea">Preferred Service Area</Label>
              <Input id="preferredServiceArea" name="preferredServiceArea" />
            </div>
            {/* Compliance & Eligibility (same as application) */}
            <div className="md:col-span-2 pt-2 border-t space-y-4">
              <p className="text-sm font-semibold">Compliance &amp; Eligibility *</p>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="authorizedToWork">Authorized to work in the US? *</Label>
                  <Select name="authorizedToWork" required>
                    <SelectTrigger>
                      <SelectValue placeholder="Select..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="true">Yes</SelectItem>
                      <SelectItem value="false">No</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="canPassBackgroundCheck">Can pass background check? *</Label>
                  <Select name="canPassBackgroundCheck" required>
                    <SelectTrigger>
                      <SelectValue placeholder="Select..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="true">Yes</SelectItem>
                      <SelectItem value="false">No</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="cprFirstAidCertified">CPR/First Aid certified? *</Label>
                  <Select name="cprFirstAidCertified" required>
                    <SelectTrigger>
                      <SelectValue placeholder="Select..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="true">Yes</SelectItem>
                      <SelectItem value="false">No</SelectItem>
                      <SelectItem value="not-yet">Not yet</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="notes">Notes</Label>
              <textarea
                id="notes"
                name="notes"
                rows={4}
                className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
              />
            </div>
          </div>

          {/* Documents Section */}
          <div className="space-y-4 border-t pt-6">
            <div>
              <Label htmlFor="documents" className="text-base font-semibold">
                Documents (Resume, Certifications, etc.)
              </Label>
              <p className="text-sm text-gray-500 mt-1">
                Upload multiple documents such as resumes, certifications, or other relevant files
              </p>
            </div>
            
            <div className="space-y-3">
              <div className="flex items-center gap-4">
                <label
                  htmlFor="file-upload"
                  className="flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-md cursor-pointer hover:bg-gray-50 transition-colors"
                >
                  <Upload className="w-4 h-4" />
                  <span className="text-sm font-medium">Select Files</span>
                </label>
                <input
                  id="file-upload"
                  type="file"
                  multiple
                  onChange={handleFileChange}
                  className="hidden"
                  accept=".pdf,.doc,.docx,.jpg,.jpeg,.png"
                />
              </div>

              {documents.length > 0 && (
                <div className="space-y-2">
                  {documents.map((doc, index) => (
                    <div
                      key={index}
                      className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg border"
                    >
                      <FileText className="w-5 h-5 text-gray-400 flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-900 truncate">
                          {doc.file.name}
                        </p>
                        <p className="text-xs text-gray-500">
                          {(doc.file.size / 1024).toFixed(1)} KB
                        </p>
                      </div>
                      <Select
                        value={doc.documentType}
                        onValueChange={(value) => updateDocumentType(index, value)}
                      >
                        <SelectTrigger className="w-40">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="RESUME">Resume</SelectItem>
                          <SelectItem value="CERTIFICATION">Certification</SelectItem>
                          <SelectItem value="OTHER">Other</SelectItem>
                        </SelectContent>
                      </Select>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => removeDocument(index)}
                        className="text-red-600 hover:text-red-700 hover:bg-red-50"
                      >
                        <X className="w-4 h-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {error && (
            <div className="text-sm text-destructive bg-destructive/10 p-3 rounded-md">
              {error}
            </div>
          )}

          <div className="flex gap-4">
            <Button type="submit" disabled={loading}>
              {loading ? 'Creating...' : 'Create Candidate'}
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => router.back()}
              disabled={loading}
            >
              Cancel
            </Button>
          </div>
        </form>
      </CardContent>

      {/* Confirmation Dialog */}
      <Dialog 
        open={confirmDialogOpen} 
        onOpenChange={(open) => {
          if (!open && !confirmLoading) {
            setConfirmDialogOpen(false)
            setPendingFormData(null)
            setPendingIsHireDirect(false)
            setError('')
          }
        }}
      >
        <DialogContent className="sm:max-w-md" onPointerDownOutside={(e) => confirmLoading && e.preventDefault()} onEscapeKeyDown={(e) => confirmLoading && e.preventDefault()}>
          <DialogHeader>
            <DialogTitle>{pendingIsHireDirect ? 'Hire RBT directly (no interview)' : 'Confirm Create RBT'}</DialogTitle>
            <DialogDescription>
              {pendingIsHireDirect
                ? 'This will add this person as HIRED with no interview process. They will have full RBT access (e.g. clock in/out, app access). Only continue if you intend to hire them directly.'
                : 'Are you sure you want to create this RBT candidate? This will add them to the system and they will be available for the hiring process.'}
            </DialogDescription>
          </DialogHeader>
          {error && (
            <div className="text-sm text-destructive bg-destructive/10 p-3 rounded-md">
              {error}
            </div>
          )}
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setConfirmDialogOpen(false)
                setPendingFormData(null)
                setPendingIsHireDirect(false)
                setConfirmLoading(false)
                setError('')
              }}
              disabled={confirmLoading}
            >
              Cancel
            </Button>
            <Button
              onClick={handleConfirmSubmit}
              disabled={confirmLoading}
              className="bg-orange-500 hover:bg-orange-600 text-white"
            >
              {confirmLoading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  {pendingIsHireDirect ? 'Hiring...' : 'Creating...'}
                </>
              ) : pendingIsHireDirect ? (
                'Confirm and hire'
              ) : (
                'Confirm'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  )
}

