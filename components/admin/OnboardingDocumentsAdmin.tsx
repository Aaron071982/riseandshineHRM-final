'use client'

import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { useToast } from '@/components/ui/toast'
import { Upload, FileText, CheckCircle2, XCircle } from 'lucide-react'

interface OnboardingDocument {
  id: string
  title: string
  slug: string
  type: 'ACKNOWLEDGMENT' | 'FILLABLE_PDF'
  pdfUrl: string | null
  pdfData: string | null
  sortOrder: number
  isActive: boolean
}

interface OnboardingDocumentsAdminProps {
  initialDocuments: OnboardingDocument[]
}

export default function OnboardingDocumentsAdmin({
  initialDocuments,
}: OnboardingDocumentsAdminProps) {
  const { showToast } = useToast()
  const [documents, setDocuments] = useState(initialDocuments)
  const [uploading, setUploading] = useState<{ [key: string]: boolean }>({})

  const handleFileChange = async (
    documentId: string,
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = event.target.files?.[0]
    if (!file) return

    if (file.type !== 'application/pdf') {
      showToast('Please upload a PDF file', 'error')
      return
    }

    setUploading({ ...uploading, [documentId]: true })

    try {
      const formData = new FormData()
      formData.append('documentId', documentId)
      formData.append('file', file)

      const response = await fetch('/api/admin/onboarding-documents', {
        method: 'POST',
        body: formData,
      })

      if (response.ok) {
        const data = await response.json()
        setDocuments(
          documents.map((doc) =>
            doc.id === documentId
              ? { ...doc, pdfData: data.document.pdfData }
              : doc
          )
        )
        showToast('PDF uploaded successfully', 'success')
      } else {
        const error = await response.json()
        showToast(error.error || 'Failed to upload PDF', 'error')
      }
    } catch (error) {
      console.error('Error uploading PDF:', error)
      showToast('An error occurred while uploading the PDF', 'error')
    } finally {
      setUploading({ ...uploading, [documentId]: false })
      // Reset file input
      event.target.value = ''
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 pb-6 border-b">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Onboarding Documents</h1>
          <p className="text-gray-600 mt-1">Manage PDF files for onboarding documents</p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Upload PDF Files</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-6">
            {documents.map((document) => (
              <div
                key={document.id}
                className="border rounded-lg p-4 space-y-4"
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3">
                      <h3 className="font-semibold text-lg">{document.title}</h3>
                      <Badge
                        variant={
                          document.type === 'ACKNOWLEDGMENT'
                            ? 'outline'
                            : 'secondary'
                        }
                      >
                        {document.type === 'ACKNOWLEDGMENT'
                          ? 'Acknowledgment'
                          : 'Fillable PDF'}
                      </Badge>
                      {document.pdfData ? (
                        <Badge className="bg-green-100 text-green-700">
                          <CheckCircle2 className="w-3 h-3 mr-1" />
                          PDF Uploaded
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="text-gray-500">
                          <XCircle className="w-3 h-3 mr-1" />
                          No PDF
                        </Badge>
                      )}
                    </div>
                    <p className="text-sm text-gray-500 mt-1">
                      Slug: {document.slug}
                    </p>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor={`file-${document.id}`}>
                    {document.pdfData ? 'Replace PDF' : 'Upload PDF'}
                  </Label>
                  <div className="flex items-center gap-4">
                    <Input
                      id={`file-${document.id}`}
                      type="file"
                      accept="application/pdf"
                      onChange={(e) => handleFileChange(document.id, e)}
                      disabled={uploading[document.id]}
                      className="cursor-pointer"
                    />
                    {uploading[document.id] && (
                      <span className="text-sm text-gray-500">Uploading...</span>
                    )}
                  </div>
                  {document.pdfData && (
                    <div className="flex items-center gap-2 text-sm text-green-600">
                      <FileText className="w-4 h-4" />
                      <span>PDF is embedded and ready for RBTs to view</span>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

