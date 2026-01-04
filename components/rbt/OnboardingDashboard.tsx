'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { CheckCircle2, Download, Circle, ExternalLink, X, Upload, Send } from 'lucide-react'
import SignaturePad from './SignaturePad'
import AcknowledgmentFlow from '@/components/onboarding/AcknowledgmentFlow'
import FillablePdfFlow from '@/components/onboarding/FillablePdfFlow'
import { useToast } from '@/components/ui/toast'

interface OnboardingDashboardProps {
  rbtProfileId: string
}

interface Task {
  id: string
  taskType: string
  title: string
  description: string | null
  documentDownloadUrl: string | null
  uploadUrl: string | null
  isCompleted: boolean
  sortOrder: number
}

interface OnboardingDocument {
  id: string
  title: string
  slug: string
  type: 'ACKNOWLEDGMENT' | 'FILLABLE_PDF'
  pdfUrl: string | null
  pdfData: string | null
  sortOrder: number
}

interface OnboardingCompletion {
  id: string
  documentId: string
  status: 'NOT_STARTED' | 'IN_PROGRESS' | 'COMPLETED'
  completedAt: string | null
  document: OnboardingDocument
}

export default function OnboardingDashboard({ rbtProfileId }: OnboardingDashboardProps) {
  const router = useRouter()
  const { showToast } = useToast()
  const [tasks, setTasks] = useState<Task[]>([])
  const [onboardingDocuments, setOnboardingDocuments] = useState<OnboardingDocument[]>([])
  const [onboardingCompletions, setOnboardingCompletions] = useState<OnboardingCompletion[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedFiles, setSelectedFiles] = useState<{ [taskId: string]: File[] }>({})
  const [uploading, setUploading] = useState<{ [taskId: string]: boolean }>({})
  const [expandedDocumentId, setExpandedDocumentId] = useState<string | null>(null)
  const [submittingDocuments, setSubmittingDocuments] = useState(false)

  const fetchAllData = async () => {
    try {
      setLoading(true)
      const [tasksResponse, docsResponse, statusResponse] = await Promise.all([
        fetch(`/api/rbt/onboarding-tasks?rbtProfileId=${rbtProfileId}`),
        fetch('/api/onboarding/docs'),
        fetch('/api/onboarding/status'),
      ])

      if (tasksResponse.ok) {
        const tasksData = await tasksResponse.json()
        setTasks(tasksData.sort((a: Task, b: Task) => a.sortOrder - b.sortOrder))
      } else {
        console.error('Failed to fetch tasks:', tasksResponse.status, await tasksResponse.text())
      }

      if (docsResponse.ok) {
        const docsData = await docsResponse.json()
        setOnboardingDocuments(docsData.documents || [])
      } else {
        console.error('Failed to fetch docs:', docsResponse.status, await docsResponse.text())
        setOnboardingDocuments([]) // Set empty array on error
      }

      if (statusResponse.ok) {
        const statusData = await statusResponse.json()
        setOnboardingCompletions(statusData.completions || [])
      } else {
        console.error('Failed to fetch status:', statusResponse.status, await statusResponse.text())
        setOnboardingCompletions([]) // Set empty array on error
      }
    } catch (error) {
      console.error('Error fetching data:', error)
      // Ensure we set empty arrays on error so the page can still render
      setOnboardingDocuments([])
      setOnboardingCompletions([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchAllData()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const getDocumentCompletionStatus = (documentId: string) => {
    const completion = onboardingCompletions.find((c) => c.documentId === documentId)
    return completion?.status || 'NOT_STARTED'
  }

  const isDocumentCompleted = (documentId: string) => {
    return getDocumentCompletionStatus(documentId) === 'COMPLETED'
  }

  const allDocumentsCompleted = () => {
    return onboardingDocuments.every((doc) => isDocumentCompleted(doc.id))
  }

  const handleSubmitAllDocuments = async () => {
    if (!allDocumentsCompleted()) {
      showToast('Please complete all documents before submitting', 'error')
      return
    }

    setSubmittingDocuments(true)
    try {
      const response = await fetch('/api/onboarding/submit-all', {
        method: 'POST',
      })

      if (response.ok) {
        showToast('All documents submitted successfully! Admins have been notified.', 'success')
      } else {
        const error = await response.json()
        showToast(error.error || 'Failed to submit documents', 'error')
      }
    } catch (error) {
      console.error('Error submitting documents:', error)
      showToast('An error occurred. Please try again.', 'error')
    } finally {
      setSubmittingDocuments(false)
    }
  }

  // Check if all tasks are complete and redirect
  useEffect(() => {
    if (!loading && tasks.length > 0 && onboardingDocuments.length > 0) {
      const allTasksCompleted = tasks.filter((t) => t.taskType !== 'PACKAGE_UPLOAD').every((task) => task.isCompleted)
      const allDocsCompleted = allDocumentsCompleted()
      if (allTasksCompleted && allDocsCompleted) {
        setTimeout(() => {
          router.refresh()
          window.location.href = '/rbt/dashboard'
        }, 1500)
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tasks, onboardingDocuments, onboardingCompletions, loading, router])

  const handleCompleteTask = async (taskId: string) => {
    try {
      const response = await fetch(`/api/rbt/onboarding-tasks/${taskId}/complete`, {
        method: 'POST',
      })

      if (response.ok) {
        fetchAllData()
      }
    } catch (error) {
      console.error('Error completing task:', error)
    }
  }

  const handleDownload = async (taskId: string, url: string, filename: string) => {
    try {
      const response = await fetch(url)
      if (!response.ok) {
        throw new Error('Download failed')
      }
      
      const blob = await response.blob()
      const downloadUrl = window.URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = downloadUrl
      link.download = filename || 'download'
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      window.URL.revokeObjectURL(downloadUrl)
      
      const task = tasks.find(t => t.id === taskId)
      if (task && !task.isCompleted) {
        await handleCompleteTask(taskId)
      }
    } catch (error) {
      console.error('Error downloading file:', error)
      alert('Failed to download file. Please try again.')
    }
  }

  const handleFileSelect = (taskId: string, files: FileList | null) => {
    if (files && files.length > 0) {
      setSelectedFiles((prev) => ({
        ...prev,
        [taskId]: Array.from(files),
      }))
    }
  }

  const handleFileUpload = async (taskId: string, isCertificate = false) => {
    const files = selectedFiles[taskId]
    
    if (!files || files.length === 0) {
      alert('Please select at least one file first.')
      return
    }

    const maxFileSize = 10 * 1024 * 1024 // 10MB
    const oversizedFiles = files.filter(file => file.size > maxFileSize)
    if (oversizedFiles.length > 0) {
      alert(`Some files are too large (max 10MB per file):\n${oversizedFiles.map(f => `${f.name} (${(f.size / 1024 / 1024).toFixed(2)} MB)`).join('\n')}\n\nPlease compress or reduce file size and try again.`)
      return
    }

    const totalSize = files.reduce((sum, file) => sum + file.size, 0)
    const maxTotalSize = 50 * 1024 * 1024 // 50MB
    if (totalSize > maxTotalSize) {
      alert(`Total file size is too large (max 50MB): ${(totalSize / 1024 / 1024).toFixed(2)} MB\n\nPlease reduce file sizes or split into smaller uploads.`)
      return
    }

    if (!confirm(`Upload ${files.length} file(s)?\n\n${files.map(f => `${f.name} (${(f.size / 1024).toFixed(2)} KB)`).join('\n')}\n\nThis will be sent to the administrator.`)) {
      return
    }

    setUploading((prev) => ({ ...prev, [taskId]: true }))

    try {
      if (isCertificate) {
        const formData = new FormData()
        formData.append('file', files[0])

        const response = await fetch(`/api/rbt/onboarding-tasks/${taskId}/upload`, {
          method: 'POST',
          body: formData,
        })

        if (response.ok) {
          const data = await response.json()
          if (data.success) {
            setSelectedFiles((prev) => {
              const newState = { ...prev }
              delete newState[taskId]
              return newState
            })
            fetchAllData()
            alert('Certificate uploaded successfully!')
          }
        } else {
          const errorData = await response.json()
          throw new Error(errorData.error || 'Upload failed')
        }
      }
    } catch (error: any) {
      console.error('Error uploading files:', error)
      const errorMessage = error.message || 'An error occurred while uploading the files. Please check your internet connection and try again.'
      alert(`Upload failed: ${errorMessage}`)
    } finally {
      setUploading((prev) => ({ ...prev, [taskId]: false }))
    }
  }

  const handleClearSelection = (taskId: string) => {
    setSelectedFiles((prev) => {
      const newState = { ...prev }
      delete newState[taskId]
      return newState
    })
    const input = document.getElementById(`file-input-${taskId}`) as HTMLInputElement
    if (input) {
      input.value = ''
    }
  }

  const handleSignatureComplete = async (taskId: string, signatureDataUrl: string) => {
    try {
      const response = await fetch(`/api/rbt/onboarding-tasks/${taskId}/sign`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ signature: signatureDataUrl }),
      })

      if (response.ok) {
        fetchAllData()
        alert('Signature submitted successfully!')
      } else {
        const errorData = await response.json()
        alert(`Failed to submit signature: ${errorData.error || 'Unknown error'}`)
      }
    } catch (error) {
      console.error('Error submitting signature:', error)
      alert('An error occurred while submitting your signature. Please try again.')
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-lg text-gray-600">Loading onboarding tasks...</div>
      </div>
    )
  }

  // Filter out PACKAGE_UPLOAD tasks
  const regularTasks = tasks.filter((t) => t.taskType !== 'PACKAGE_UPLOAD')
  const completedTasksCount = regularTasks.filter((t) => t.isCompleted).length
  const completedDocumentsCount = onboardingDocuments.filter((doc) => isDocumentCompleted(doc.id)).length
  const totalTasksCount = regularTasks.length + onboardingDocuments.length
  const totalCompletedCount = completedTasksCount + completedDocumentsCount
  const progressPercentage = totalTasksCount > 0 ? (totalCompletedCount / totalTasksCount) * 100 : 0
  const allTasksCompleted = totalTasksCount > 0 && totalCompletedCount === totalTasksCount

  const documentTasks = regularTasks.filter((t) => t.taskType === 'DOWNLOAD_DOC')
  const signatureTasks = regularTasks.filter((t) => t.taskType === 'SIGNATURE')
  const fortyHourCourseTasks = regularTasks.filter((t) => t.taskType === 'FORTY_HOUR_COURSE_CERTIFICATE')

  if (allTasksCompleted) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center space-y-4">
          <CheckCircle2 className="w-16 h-16 text-green-500 mx-auto" />
          <h2 className="text-2xl font-bold text-gray-900">All Tasks Completed!</h2>
          <p className="text-gray-600">Redirecting you to your dashboard...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-8 p-6">
      <div className="text-center space-y-4">
        <h1 className="text-3xl font-bold text-gray-900">Welcome to Rise and Shine!</h1>
        <p className="text-lg text-gray-600 max-w-2xl mx-auto">
          Before you can view your schedule and client assignments, please complete your onboarding checklist.
        </p>
      </div>

      {/* Progress Bar */}
      <Card>
        <CardHeader>
          <CardTitle>Onboarding Progress</CardTitle>
          <CardDescription>
            {totalCompletedCount} of {totalTasksCount} tasks completed
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="w-full bg-gray-200 rounded-full h-4">
            <div
              className="bg-orange-600 h-4 rounded-full transition-all"
              style={{ width: `${progressPercentage}%` }}
            />
          </div>
          <p className="text-sm text-gray-600 mt-2 text-center">
            {Math.round(progressPercentage)}% Complete
          </p>
        </CardContent>
      </Card>

      {/* Documents Section */}
      {documentTasks.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Documents to Download & Review</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-6">
              {documentTasks.map((task) => (
                <div key={task.id} className="border rounded-lg p-4 space-y-3">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        {task.isCompleted ? (
                          <CheckCircle2 className="w-5 h-5 text-green-500" />
                        ) : (
                          <Circle className="w-5 h-5 text-gray-400" />
                        )}
                        <h3 className="font-medium">{task.title}</h3>
                      </div>
                      {task.description && (
                        <p className="text-sm text-gray-600 mt-1">{task.description}</p>
                      )}
                    </div>
                    {task.isCompleted && <Badge className="bg-green-500">Completed</Badge>}
                  </div>
                  {task.documentDownloadUrl && (
                    <div className="flex gap-2">
                      {task.documentDownloadUrl.startsWith('/api/') || task.documentDownloadUrl.includes('download') ? (
                        <Button
                          variant="outline"
                          onClick={() => {
                            const filename = task.title.toLowerCase().includes('folder') 
                              ? 'onboarding-documents.zip'
                              : 'download.zip'
                            handleDownload(task.id, task.documentDownloadUrl!, filename)
                          }}
                          className="flex items-center gap-2"
                        >
                          <Download className="w-4 h-4" />
                          {task.title.toLowerCase().includes('folder') || task.title.toLowerCase().includes('package') 
                            ? 'Download Folder' 
                            : 'Download'}
                        </Button>
                      ) : task.documentDownloadUrl.includes('.pdf') || task.documentDownloadUrl.includes('pdf') ? (
                        <Button
                          variant="outline"
                          onClick={async () => {
                            window.open(task.documentDownloadUrl || '', '_blank', 'noopener,noreferrer')
                            if (!task.isCompleted) {
                              await handleCompleteTask(task.id)
                            }
                          }}
                          className="flex items-center gap-2"
                        >
                          <Download className="w-4 h-4" />
                          Download PDF
                        </Button>
                      ) : (
                        <Button
                          variant="outline"
                          onClick={async () => {
                            window.open(task.documentDownloadUrl || '', '_blank', 'noopener,noreferrer')
                            if (!task.isCompleted) {
                              await handleCompleteTask(task.id)
                            }
                          }}
                          className="flex items-center gap-2"
                        >
                          <ExternalLink className="w-4 h-4" />
                          Open Link
                        </Button>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Signature Section */}
      {signatureTasks.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Digital Signature Confirmation</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {signatureTasks.map((task) => (
                <div key={task.id} className="border rounded-lg p-4 space-y-3">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        {task.isCompleted ? (
                          <CheckCircle2 className="w-5 h-5 text-green-500" />
                        ) : (
                          <Circle className="w-5 h-5 text-gray-400" />
                        )}
                        <h3 className="font-medium">{task.title}</h3>
                      </div>
                      {task.description && (
                        <p className="text-sm text-gray-600 mt-1">{task.description}</p>
                      )}
                    </div>
                    {task.isCompleted && <Badge className="bg-green-500">Completed</Badge>}
                  </div>
                  {!task.isCompleted && (
                    <SignaturePad
                      onSignatureComplete={(signatureDataUrl) =>
                        handleSignatureComplete(task.id, signatureDataUrl)
                      }
                    />
                  )}
                  {task.isCompleted && task.uploadUrl && (
                    <div className="mt-4 p-4 bg-gray-50 rounded-lg">
                      <p className="text-sm text-gray-600 mb-2">Your signature:</p>
                      <img
                        src={task.uploadUrl}
                        alt="Signature"
                        className="max-w-md border border-gray-300 rounded"
                      />
                    </div>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* 40-Hour Course Certificate Section */}
      {fortyHourCourseTasks.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>40-Hour RBT Course Certificate</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {fortyHourCourseTasks.map((task) => (
                <div key={task.id} className="border rounded-lg p-4 space-y-3">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        {task.isCompleted ? (
                          <CheckCircle2 className="w-5 h-5 text-green-500" />
                        ) : (
                          <Circle className="w-5 h-5 text-gray-400" />
                        )}
                        <h3 className="font-medium">{task.title}</h3>
                      </div>
                      {task.description && (
                        <p className="text-sm text-gray-600 mt-1">{task.description}</p>
                      )}
                    </div>
                    {task.isCompleted && <Badge className="bg-green-500">Completed</Badge>}
                  </div>
                  {task.documentDownloadUrl && (
                    <div>
                      <Button
                        variant="outline"
                        onClick={() => {
                          window.open(task.documentDownloadUrl || '', '_blank', 'noopener,noreferrer')
                        }}
                        className="flex items-center gap-2 mb-4"
                      >
                        <ExternalLink className="w-4 h-4" />
                        Access 40-Hour Course
                      </Button>
                    </div>
                  )}
                  {!task.isCompleted && (
                    <div className="space-y-3">
                      <div>
                        <input
                          id={`file-input-${task.id}`}
                          type="file"
                          accept=".pdf,.jpg,.jpeg,.png"
                          onChange={(e) => {
                            handleFileSelect(task.id, e.target.files)
                          }}
                          className="text-sm"
                        />
                        <p className="text-xs text-gray-500 mt-2">Accepted formats: PDF, JPG, PNG. Please upload your certificate of completion.</p>
                      </div>

                      {selectedFiles[task.id] && selectedFiles[task.id].length > 0 && (
                        <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg space-y-2">
                          <p className="text-sm font-medium text-blue-900">
                            Selected File:
                          </p>
                          <ul className="text-xs text-blue-800 space-y-1 list-disc list-inside">
                            {selectedFiles[task.id].map((file, index) => (
                              <li key={index}>
                                {file.name} ({(file.size / 1024).toFixed(2)} KB)
                              </li>
                            ))}
                          </ul>
                          <div className="flex gap-2 mt-3">
                            <Button
                              onClick={() => handleFileUpload(task.id, true)}
                              disabled={uploading[task.id]}
                              className="bg-orange-600 hover:bg-orange-700 text-white flex items-center gap-2"
                            >
                              {uploading[task.id] ? (
                                <>
                                  <Circle className="w-4 h-4 animate-spin" />
                                  Uploading...
                                </>
                              ) : (
                                <>
                                  <Upload className="w-4 h-4" />
                                  Confirm & Upload Certificate
                                </>
                              )}
                            </Button>
                            <Button
                              variant="outline"
                              onClick={() => handleClearSelection(task.id)}
                              disabled={uploading[task.id]}
                              className="flex items-center gap-2"
                            >
                              <X className="w-4 h-4" />
                              Clear Selection
                            </Button>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                  {task.isCompleted && task.uploadUrl && (
                    <div className="mt-4 ml-7 p-3 bg-gray-50 rounded-lg">
                      <p className="text-sm text-gray-600">
                        ✅ Certificate uploaded successfully
                      </p>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Onboarding Documents Section */}
      {onboardingDocuments.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Onboarding Documents</CardTitle>
            <CardDescription>
              Complete all required documents and acknowledgments. All documents are embedded and can be completed directly in this system.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {onboardingDocuments.map((document) => {
                const completion = onboardingCompletions.find((c) => c.documentId === document.id)
                const isCompleted = isDocumentCompleted(document.id)
                const isExpanded = expandedDocumentId === document.id

                return (
                  <div key={document.id} className="border rounded-lg">
                    <div
                      className="p-4 cursor-pointer hover:bg-gray-50 transition-colors"
                      onClick={() => setExpandedDocumentId(isExpanded ? null : document.id)}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          {isCompleted ? (
                            <CheckCircle2 className="w-6 h-6 text-green-500" />
                          ) : (
                            <Circle className="w-6 h-6 text-gray-400" />
                          )}
                          <div>
                            <h3 className="font-medium text-lg">{document.title}</h3>
                            <Badge
                              variant={document.type === 'ACKNOWLEDGMENT' ? 'outline' : 'secondary'}
                              className="mt-1"
                            >
                              {document.type === 'ACKNOWLEDGMENT' ? 'Acknowledgment' : 'Fillable PDF'}
                            </Badge>
                          </div>
                        </div>
                        <Badge
                          className={
                            isCompleted
                              ? 'bg-green-100 text-green-700'
                              : completion?.status === 'IN_PROGRESS'
                              ? 'bg-yellow-100 text-yellow-700'
                              : 'bg-gray-100 text-gray-600'
                          }
                        >
                          {isCompleted
                            ? 'Completed'
                            : completion?.status === 'IN_PROGRESS'
                            ? 'In Progress'
                            : 'Not Started'}
                        </Badge>
                      </div>
                    </div>
                    {isExpanded && (
                      <div className="border-t p-4 bg-gray-50">
                        {document.type === 'ACKNOWLEDGMENT' ? (
                          <AcknowledgmentFlow
                            document={document}
                            completion={completion}
                            onComplete={fetchAllData}
                          />
                        ) : (
                          <FillablePdfFlow
                            document={document}
                            completion={completion}
                            onComplete={fetchAllData}
                          />
                        )}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>

            {/* Submit All Documents Button */}
            {allDocumentsCompleted() && (
              <div className="mt-6 p-4 bg-green-50 border-2 border-green-200 rounded-lg">
                <div className="text-center space-y-4">
                  <div className="flex items-center justify-center gap-2 text-green-700">
                    <CheckCircle2 className="w-6 h-6" />
                    <p className="text-lg font-semibold">All documents completed!</p>
                  </div>
                  <p className="text-gray-600">
                    Review all documents above, then click the button below to submit everything.
                    Admins will be notified upon submission.
                  </p>
                  <Button
                    onClick={handleSubmitAllDocuments}
                    disabled={submittingDocuments}
                    size="lg"
                    className="bg-green-600 hover:bg-green-700 text-white"
                  >
                    <Send className="w-5 h-5 mr-2" />
                    {submittingDocuments ? 'Submitting...' : 'Submit All Documents'}
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  )
}
