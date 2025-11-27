'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { CheckCircle2, Download, Upload, Play, Circle } from 'lucide-react'

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
  const [tasks, setTasks] = useState<Task[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchTasks()
  }, [])

  const fetchTasks = async () => {
    try {
      const response = await fetch(`/api/rbt/onboarding-tasks?rbtProfileId=${rbtProfileId}`)
      const data = await response.json()
      if (response.ok) {
        setTasks(data)
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

  const handleFileUpload = async (taskId: string, file: File) => {
    try {
      const formData = new FormData()
      formData.append('file', file)

      const response = await fetch(`/api/rbt/onboarding-tasks/${taskId}/upload`, {
        method: 'POST',
        body: formData,
      })

      if (response.ok) {
        fetchTasks()
      }
    } catch (error) {
      console.error('Error uploading file:', error)
    }
  }

  if (loading) {
    return <div>Loading...</div>
  }

  const completedCount = tasks.filter((t) => t.isCompleted).length
  const totalCount = tasks.length
  const progressPercentage = totalCount > 0 ? (completedCount / totalCount) * 100 : 0

  const documentTasks = tasks.filter((t) => t.taskType === 'DOWNLOAD_DOC' || t.taskType === 'UPLOAD_SIGNED_DOC')
  const videoTasks = tasks.filter((t) => t.taskType === 'VIDEO_COURSE')

  return (
    <div className="space-y-8">
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
              className="bg-primary h-4 rounded-full transition-all"
              style={{ width: `${progressPercentage}%` }}
            />
          </div>
          <p className="text-sm text-gray-600 mt-2 text-center">
            {Math.round(progressPercentage)}% Complete
          </p>
        </CardContent>
      </Card>

      {/* Documents Section */}
      <Card>
        <CardHeader>
          <CardTitle>Documents to Download & Upload</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-6">
            {documentTasks.map((task) => {
              if (task.taskType === 'DOWNLOAD_DOC') {
                return (
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
                      {task.isCompleted && <Badge variant="success">Completed</Badge>}
                    </div>
                    {!task.isCompleted && task.documentDownloadUrl && (
                      <Button
                        variant="outline"
                        onClick={() => window.open(task.documentDownloadUrl || '#', '_blank')}
                      >
                        <Download className="w-4 h-4 mr-2" />
                        Download Document
                      </Button>
                    )}
                  </div>
                )
              } else {
                // UPLOAD_SIGNED_DOC
                return (
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
                      {task.isCompleted && <Badge variant="success">Completed</Badge>}
                    </div>
                    {!task.isCompleted && (
                      <div className="space-y-2">
                        <input
                          type="file"
                          accept=".pdf,.doc,.docx"
                          onChange={(e) => {
                            const file = e.target.files?.[0]
                            if (file) {
                              handleFileUpload(task.id, file)
                            }
                          }}
                          className="text-sm"
                        />
                        <p className="text-xs text-gray-500">Accepted formats: PDF, DOC, DOCX</p>
                      </div>
                    )}
                  </div>
                )
              }
            })}
          </div>
        </CardContent>
      </Card>

      {/* Training Videos Section */}
      <Card>
        <CardHeader>
          <CardTitle>HIPAA Training Videos</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {videoTasks.map((task) => (
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
                  {task.isCompleted && <Badge variant="success">Completed</Badge>}
                </div>
                {!task.isCompleted && (
                  <div className="flex gap-2">
                    {task.documentDownloadUrl && (
                      <Button
                        variant="outline"
                        onClick={() => window.open(task.documentDownloadUrl || '#', '_blank')}
                      >
                        <Play className="w-4 h-4 mr-2" />
                        Watch Video
                      </Button>
                    )}
                    <Button
                      onClick={() => handleCompleteTask(task.id)}
                      disabled={task.isCompleted}
                    >
                      Mark as Complete
                    </Button>
                  </div>
                )}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

