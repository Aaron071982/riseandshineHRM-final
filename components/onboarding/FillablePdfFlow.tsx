'use client'

import { useState, useEffect, useRef } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { useToast } from '@/components/ui/toast'
import { Download, Upload, FileText, CheckCircle2, Loader2 } from 'lucide-react'

interface OnboardingDocument {
  id: string
  title: string
  slug: string
  type: 'ACKNOWLEDGMENT' | 'FILLABLE_PDF'
  pdfUrl: string | null
  pdfData: string | null
}

interface Completion {
  id: string
  documentId: string
  status: 'NOT_STARTED' | 'IN_PROGRESS' | 'COMPLETED'
  completedAt: string | null
  draftData?: any
}

interface FillablePdfFlowProps {
  document: OnboardingDocument
  completion: Completion | undefined
  onComplete: () => void
}

export default function FillablePdfFlow({
  document,
  completion,
  onComplete,
}: FillablePdfFlowProps) {
  const { showToast } = useToast()
  const [isCompleted, setIsCompleted] = useState(completion?.status === 'COMPLETED')
  const [uploading, setUploading] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (completion?.status === 'COMPLETED') {
      setIsCompleted(true)
    }
  }, [completion])

  const handleDownload = () => {
    if (!document.pdfData) {
      showToast('PDF data not available', 'error')
      return
    }

    try {
      // Convert base64 to blob
      const binaryString = atob(document.pdfData)
      const bytes = new Uint8Array(binaryString.length)
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i)
      }
      const blob = new Blob([bytes], { type: 'application/pdf' })
      
      // Create download link
      const url = URL.createObjectURL(blob)
      const link = window.document.createElement('a')
      link.href = url
      link.download = `${document.slug || document.title.replace(/[^a-z0-9]/gi, '_')}.pdf`
      window.document.body.appendChild(link)
      link.click()
      window.document.body.removeChild(link)
      URL.revokeObjectURL(url)
      
      showToast('PDF downloaded successfully', 'success')
    } catch (error) {
      console.error('Error downloading PDF:', error)
      showToast('Failed to download PDF. Please try again.', 'error')
    }
  }

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    // Validate file type
    if (file.type !== 'application/pdf') {
      showToast('Please upload a PDF file', 'error')
      return
    }

    // Validate file size (max 10MB)
    const maxSize = 10 * 1024 * 1024 // 10MB
    if (file.size > maxSize) {
      showToast('File size must be less than 10MB', 'error')
      return
    }

    await handleUpload(file)
  }

  const handleUpload = async (file: File) => {
    try {
      setUploading(true)

      const formData = new FormData()
      formData.append('documentId', document.id)
      formData.append('filledPdf', file)

      const response = await fetch('/api/onboarding/pdf/upload', {
        method: 'POST',
        body: formData,
      })

      if (response.ok) {
        showToast('Document uploaded successfully', 'success')
        setIsCompleted(true)
        onComplete() // Refresh to show completion status
      } else {
        const error = await response.json()
        showToast(error.error || 'Failed to upload document', 'error')
      }
    } catch (error) {
      console.error('Error uploading PDF:', error)
      showToast('An error occurred while uploading. Please try again.', 'error')
    } finally {
      setUploading(false)
      // Reset file input
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }
    }
  }

  if (isCompleted) {
    return (
      <Card>
        <CardContent className="pt-6">
          <div className="text-center space-y-4">
            <div className="flex items-center justify-center gap-2 text-green-600 font-semibold text-lg">
              <CheckCircle2 className="w-6 h-6" />
              <span>
                Completed on{' '}
                {completion?.completedAt
                  ? new Date(completion.completedAt).toLocaleDateString()
                  : ''}
              </span>
            </div>
            <p className="text-gray-600">This document has been completed and submitted.</p>
          </div>
        </CardContent>
      </Card>
    )
  }

  if (!document.pdfData) {
    return (
      <Card>
        <CardContent className="pt-6">
          <div className="text-center text-gray-500 py-12">
            <p className="font-semibold mb-2">PDF not available</p>
            <p className="text-sm">
              The PDF data for this document is missing. Please contact support or try refreshing the page.
            </p>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardContent className="pt-6 space-y-6">
        {/* Instructions */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <h3 className="font-semibold text-blue-900 mb-3 flex items-center gap-2">
            <FileText className="w-5 h-5" />
            How to Complete This Document
          </h3>
          <ol className="list-decimal list-inside space-y-2 text-sm text-blue-800">
            <li>
              <strong>Download the PDF</strong> using the button below. This is a fillable PDF form.
            </li>
            <li>
              <strong>Open the PDF</strong> in a PDF viewer (Adobe Acrobat, Preview on Mac, Adobe Reader, or similar).
            </li>
            <li>
              <strong>Fill out all required fields</strong> directly in the PDF form.
            </li>
            <li>
              <strong>Save the filled PDF</strong> to your device.
            </li>
            <li>
              <strong>Upload your completed PDF</strong> using the upload button below.
            </li>
          </ol>
          <p className="text-xs text-blue-700 mt-3 italic">
            Note: The PDF must be opened in a PDF viewer application (not just a web browser) to properly fill out the form fields.
          </p>
        </div>

        {/* Download Button */}
        <div className="flex flex-col items-center gap-4">
          <Button
            onClick={handleDownload}
            className="w-full sm:w-auto"
            variant="outline"
            disabled={uploading}
          >
            <Download className="w-4 h-4 mr-2" />
            Download PDF Form
          </Button>

          {/* Upload Section */}
          <div className="w-full space-y-3">
            <div className="flex items-center justify-center">
              <div className="border-t border-gray-300 flex-grow"></div>
              <span className="px-4 text-sm text-gray-500">or</span>
              <div className="border-t border-gray-300 flex-grow"></div>
            </div>

            <div className="flex flex-col items-center gap-3">
              <input
                ref={fileInputRef}
                type="file"
                accept=".pdf,application/pdf"
                onChange={handleFileSelect}
                className="hidden"
                id={`pdf-upload-${document.id}`}
                disabled={uploading}
              />
              <Button
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
                className="w-full sm:w-auto"
              >
                {uploading ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Uploading...
                  </>
                ) : (
                  <>
                    <Upload className="w-4 h-4 mr-2" />
                    Upload Filled PDF
                  </>
                )}
              </Button>
              <p className="text-xs text-gray-500 text-center">
                Maximum file size: 10MB
              </p>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
