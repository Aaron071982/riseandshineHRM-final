'use client'

import { useState } from 'react'
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
    
    // Create FormData for file upload
    const submitData = new FormData()
    submitData.append('firstName', formData.get('firstName') as string)
    submitData.append('lastName', formData.get('lastName') as string)
    submitData.append('phoneNumber', formData.get('phoneNumber') as string)
    submitData.append('email', (formData.get('email') as string) || '')
    submitData.append('locationCity', (formData.get('locationCity') as string) || '')
    submitData.append('locationState', (formData.get('locationState') as string) || '')
    submitData.append('zipCode', formData.get('zipCode') as string)
    submitData.append('addressLine1', formData.get('addressLine1') as string)
    submitData.append('addressLine2', (formData.get('addressLine2') as string) || '')
    submitData.append('preferredServiceArea', (formData.get('preferredServiceArea') as string) || '')
    submitData.append('notes', (formData.get('notes') as string) || '')
    submitData.append('gender', formData.get('gender') as string)
    submitData.append('status', formData.get('status') as string)
    submitData.append('fortyHourCourseCompleted', formData.get('fortyHourCourseCompleted') === 'true' ? 'true' : 'false')

    // Add documents
    documents.forEach((doc, index) => {
      submitData.append(`documents`, doc.file)
      submitData.append(`documentTypes`, doc.documentType)
    })

    // Store form data and show confirmation
    setPendingFormData(submitData)
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
              <Label htmlFor="email">Email</Label>
              <Input id="email" name="email" type="email" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="locationCity">City</Label>
              <Input id="locationCity" name="locationCity" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="locationState">State</Label>
              <Input id="locationState" name="locationState" maxLength={2} placeholder="NY" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="zipCode">Zip Code *</Label>
              <Input id="zipCode" name="zipCode" required />
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
              <Label htmlFor="status">Initial Status *</Label>
              <Select name="status" required defaultValue="NEW">
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="NEW">New</SelectItem>
                  <SelectItem value="REACH_OUT">Reach Out</SelectItem>
                  <SelectItem value="TO_INTERVIEW">To Interview</SelectItem>
                </SelectContent>
              </Select>
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
            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="addressLine1">Address Line 1 *</Label>
              <Input id="addressLine1" name="addressLine1" required />
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="addressLine2">Address Line 2</Label>
              <Input id="addressLine2" name="addressLine2" />
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="preferredServiceArea">Preferred Service Area</Label>
              <Input id="preferredServiceArea" name="preferredServiceArea" />
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
          // Prevent closing during loading
          if (!open && !confirmLoading) {
            setConfirmDialogOpen(false)
            setPendingFormData(null)
          }
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Confirm Create RBT</DialogTitle>
            <DialogDescription>
              Are you sure you want to create this RBT candidate? This will add them to the system and they will be available for the hiring process.
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
                  Creating...
                </>
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

