'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { CheckCircle2, Download, Circle, ExternalLink, X, Upload } from 'lucide-react'
import SignaturePad from './SignaturePad'

interface OnboardingDashboardProps {
  rbtProfileId: string
}

interface Task {
  id: string
  taskType: string
  title: string
  description: string | null
  documentDownloadUrl: string | null
  isCompleted: boolean
  sortOrder: number
}

export default function OnboardingDashboard({ rbtProfileId }: OnboardingDashboardProps) {
  const router = useRouter()
  const [tasks, setTasks] = useState<Task[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedFiles, setSelectedFiles] = useState<{ [taskId: string]: File[] }>({})
  const [uploading, setUploading] = useState<{ [taskId: string]: boolean }>({})

  useEffect(() => {
    fetchTasks()
  }, [])

  // Check if all tasks are complete and redirect
  useEffect(() => {
    if (tasks.length > 0) {
      const allTasksCompleted = tasks.every((task) => task.isCompleted)
      if (allTasksCompleted) {
        // Wait a moment then redirect to refresh and show main dashboard
        setTimeout(() => {
          router.refresh()
          window.location.href = '/rbt/dashboard'
        }, 1500)
      }
    }
  }, [tasks, router])

  const fetchTasks = async () => {
    try {
      const response = await fetch(`/api/rbt/onboarding-tasks?rbtProfileId=${rbtProfileId}`)
      const data = await response.json()
      if (response.ok) {
        setTasks(data.sort((a: Task, b: Task) => a.sortOrder - b.sortOrder))
      } else {
        console.error('Failed to fetch tasks:', data.error)
      }
    } catch (error) {
      console.error('Error fetching tasks:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleCompleteTask = async (taskId: string) => {
    try {
      const response = await fetch(`/api/rbt/onboarding-tasks/${taskId}/complete`, {
        method: 'POST',
      })

      if (response.ok) {
        fetchTasks()
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
      
      // Mark task as complete if not already
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

  const handleFileUpload = async (taskId: string) => {
    const files = selectedFiles[taskId]
    
    if (!files || files.length === 0) {
      alert('Please select at least one file first.')
      return
    }

    if (!confirm(`Upload ${files.length} file(s)?\n\n${files.map(f => f.name).join('\n')}\n\nThis will be sent to the administrator.`)) {
      return
    }

    setUploading((prev) => ({ ...prev, [taskId]: true }))

    try {
      const formData = new FormData()
      files.forEach((file) => {
        formData.append('files', file)
      })

      const response = await fetch(`/api/rbt/onboarding-tasks/${taskId}/upload-files`, {
        method: 'POST',
        body: formData,
      })

      if (response.ok) {
        const data = await response.json()
        if (data.success) {
          // Clear selected files for this task
          setSelectedFiles((prev) => {
            const newState = { ...prev }
            delete newState[taskId]
            return newState
          })
          fetchTasks()
          alert(`Successfully uploaded ${data.filesCount} file(s)! The onboarding package has been sent to the administrator.`)
        }
      } else {
        const errorData = await response.json()
        alert(`Failed to upload files: ${errorData.error || 'Unknown error'}`)
      }
    } catch (error) {
      console.error('Error uploading files:', error)
      alert('An error occurred while uploading the files. Please try again.')
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
    // Reset the file input
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
        fetchTasks()
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

  const completedCount = tasks.filter((t) => t.isCompleted).length
  const totalCount = tasks.length
  const progressPercentage = totalCount > 0 ? (completedCount / totalCount) * 100 : 0
  const allTasksCompleted = totalCount > 0 && completedCount === totalCount

  const documentTasks = tasks.filter((t) => t.taskType === 'DOWNLOAD_DOC')
  const signatureTasks = tasks.filter((t) => t.taskType === 'SIGNATURE')
  const packageUploadTasks = tasks.filter((t) => t.taskType === 'PACKAGE_UPLOAD')

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
            {completedCount} of {totalCount} tasks completed
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
                        // For API download endpoints, use JavaScript download
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
                        // For PDF files
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
                        // For external links
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

      {/* Package Upload Section */}
      {packageUploadTasks.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Onboarding Package Upload</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {packageUploadTasks.map((task) => (
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
                    <div className="space-y-3">
                      <div>
                        <input
                          id={`file-input-${task.id}`}
                          type="file"
                          accept=".pdf,.zip,.rar,.7z"
                          multiple
                          onChange={(e) => {
                            handleFileSelect(task.id, e.target.files)
                          }}
                          className="text-sm"
                        />
                        <p className="text-xs text-gray-500 mt-2">Accepted formats: PDF, ZIP, RAR, 7Z. You can select multiple files at once.</p>
                        <div className="mt-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                          <p className="text-sm font-semibold text-blue-900 mb-2">Important Instructions:</p>
                          <ol className="text-xs text-blue-800 space-y-1 list-decimal list-inside">
                            <li>Read through all documents carefully</li>
                            <li>Sign all required documents (either digitally using an online tool or print and sign by hand)</li>
                            <li>Collect all completed and signed documents in a folder</li>
                            <li>Zip/compress the entire folder containing all your documentation</li>
                            <li>Upload the zipped folder using the button below</li>
                          </ol>
                        </div>
                      </div>

                      {/* Show selected files */}
                      {selectedFiles[task.id] && selectedFiles[task.id].length > 0 && (
                        <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg space-y-2">
                          <p className="text-sm font-medium text-blue-900">
                            Selected Files ({selectedFiles[task.id].length}):
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
                              onClick={() => handleFileUpload(task.id)}
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
                                  Confirm & Upload Files
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

                      <p className="text-xs text-orange-600 font-medium">
                        All files will be automatically emailed to the administrator as a ZIP package upon upload.
                      </p>
                    </div>
                  )}
                  {task.isCompleted && task.uploadUrl && (
                    <div className="mt-4 ml-7 p-3 bg-gray-50 rounded-lg">
                      <p className="text-sm text-gray-600">
                        ✅ Package uploaded successfully
                      </p>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
