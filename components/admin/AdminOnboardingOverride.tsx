'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { CheckCircle2, XCircle, Upload, Check, Calendar, Loader2 } from 'lucide-react'
import { useToast } from '@/components/ui/toast'
import { formatDateTime } from '@/lib/utils'

interface AdminOnboardingOverrideProps {
  rbtProfileId: string
  rbtName: string
  onboardingTasks: Array<{
    id: string
    taskType: string
    title: string
    description: string | null
    isCompleted: boolean
    completedAt: Date | null
    uploadUrl: string | null
    documentDownloadUrl: string | null
    sortOrder: number
  }>
  scheduleCompleted: boolean
}

const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
const HOURS = Array.from({ length: 8 }, (_, i) => i + 14) // 2 PM to 9 PM (14-21)

export default function AdminOnboardingOverride({
  rbtProfileId,
  rbtName,
  onboardingTasks,
  scheduleCompleted,
}: AdminOnboardingOverrideProps) {
  const router = useRouter()
  const { showToast } = useToast()
  const [loading, setLoading] = useState(false)
  const [loadingSchedule, setLoadingSchedule] = useState(true)
  const [selectedSlots, setSelectedSlots] = useState<Set<string>>(new Set())
  const [uploadingPackage, setUploadingPackage] = useState(false)

  // Load existing availability on mount
  useEffect(() => {
    fetchExistingAvailability()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rbtProfileId])

  const fetchExistingAvailability = async () => {
    try {
      setLoadingSchedule(true)
      const response = await fetch(`/api/admin/rbts/${rbtProfileId}/availability`)
      if (response.ok) {
        const slots: Array<{ dayOfWeek: number; hour: number }> = await response.json()
        const slotKeys = new Set<string>(
          slots.map((slot) => `${slot.dayOfWeek}-${slot.hour}`)
        )
        setSelectedSlots(slotKeys)
      }
    } catch (err) {
      console.error('Error fetching availability:', err)
    } finally {
      setLoadingSchedule(false)
    }
  }

  const toggleSlot = (dayOfWeek: number, hour: number) => {
    const key = `${dayOfWeek}-${hour}`
    const newSelected = new Set(selectedSlots)
    if (newSelected.has(key)) {
      newSelected.delete(key)
    } else {
      newSelected.add(key)
    }
    setSelectedSlots(newSelected)
  }

  const handleCompleteTask = async (taskId: string) => {
    setLoading(true)
    try {
      const response = await fetch(`/api/admin/rbts/${rbtProfileId}/onboarding/complete-task`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ taskId }),
      })

      if (response.ok) {
        showToast('Task marked as complete', 'success')
        router.refresh()
      } else {
        const data = await response.json()
        showToast(data.error || 'Failed to complete task', 'error')
      }
    } catch (error) {
      console.error('Error completing task:', error)
      showToast('An error occurred while completing task', 'error')
    } finally {
      setLoading(false)
    }
  }

  const handleUploadPackage = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || [])
    if (files.length === 0) return

    setUploadingPackage(true)
    try {
      const formData = new FormData()
      files.forEach((file) => {
        formData.append('files', file)
      })

      const response = await fetch(`/api/admin/rbts/${rbtProfileId}/onboarding/upload-package`, {
        method: 'POST',
        body: formData,
      })

      if (response.ok) {
        showToast(`Successfully uploaded ${files.length} file(s) as onboarding package`, 'success')
        router.refresh()
      } else {
        const data = await response.json()
        showToast(data.error || 'Failed to upload package', 'error')
      }
    } catch (error) {
      console.error('Error uploading package:', error)
      showToast('An error occurred while uploading package', 'error')
    } finally {
      setUploadingPackage(false)
    }
  }

  const handleSaveSchedule = async () => {
    if (selectedSlots.size === 0) {
      showToast('Please select at least one time slot', 'warning')
      return
    }

    setLoading(true)
    try {
      const slots = Array.from(selectedSlots).map((key) => {
        const [dayOfWeek, hour] = key.split('-').map(Number)
        return { dayOfWeek, hour }
      })

      const response = await fetch(`/api/admin/rbts/${rbtProfileId}/onboarding/set-schedule`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ slots }),
      })

      if (response.ok) {
        showToast('Schedule set successfully', 'success')
        router.refresh()
      } else {
        const data = await response.json()
        showToast(data.error || 'Failed to set schedule', 'error')
      }
    } catch (error) {
      console.error('Error setting schedule:', error)
      showToast('An error occurred while setting schedule', 'error')
    } finally {
      setLoading(false)
    }
  }

  const packageTask = onboardingTasks.find((t) => t.taskType === 'PACKAGE_UPLOAD')
  const incompleteTasks = onboardingTasks.filter((t) => !t.isCompleted)

  return (
    <Card className="border-2 border-orange-200 bg-gradient-to-br from-orange-50/50 to-white">
      <CardHeader>
        <CardTitle className="text-xl font-bold text-gray-900">
          Admin Onboarding Override
        </CardTitle>
        <p className="text-sm text-gray-600">
          Complete onboarding tasks on behalf of {rbtName}
        </p>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Incomplete Tasks List */}
        {incompleteTasks.length > 0 && (
          <div className="space-y-3">
            <h3 className="font-semibold text-gray-900">Incomplete Tasks</h3>
            {incompleteTasks.map((task) => (
              <div key={task.id} className="border rounded-lg p-4 bg-white">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <XCircle className="w-5 h-5 text-gray-400" />
                      <h4 className="font-medium">{task.title}</h4>
                    </div>
                    {task.description && (
                      <p className="text-sm text-gray-600 mt-1 ml-7">{task.description}</p>
                    )}
                  </div>
                  {task.taskType === 'PACKAGE_UPLOAD' ? (
                    <div className="flex flex-col gap-2">
                      <label
                        htmlFor="package-upload-override"
                        className="flex items-center gap-2 px-3 py-2 border border-gray-300 rounded-md cursor-pointer hover:bg-gray-50 transition-colors text-sm"
                      >
                        <Upload className="w-4 h-4" />
                        {uploadingPackage ? 'Uploading...' : 'Upload Package'}
                      </label>
                      <input
                        id="package-upload-override"
                        type="file"
                        multiple
                        onChange={handleUploadPackage}
                        className="hidden"
                        disabled={uploadingPackage}
                      />
                    </div>
                  ) : task.taskType === 'SIGNATURE' ? (
                    <Button
                      size="sm"
                      onClick={() => handleCompleteTask(task.id)}
                      disabled={loading}
                      className="bg-orange-500 hover:bg-orange-600"
                    >
                      <Check className="w-4 h-4 mr-1" />
                      Mark Signed
                    </Button>
                  ) : (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleCompleteTask(task.id)}
                      disabled={loading}
                    >
                      <Check className="w-4 h-4 mr-1" />
                      Mark Complete
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Schedule Setup */}
        {!scheduleCompleted && (
          <div className="space-y-3 border-t pt-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-semibold text-gray-900 flex items-center gap-2">
                  <Calendar className="w-5 h-5 text-orange-500" />
                  Set Weekly Availability
                </h3>
                <p className="text-sm text-gray-600 mt-1">
                  Set the weekly schedule for {rbtName}
                </p>
              </div>
              <Button
                onClick={handleSaveSchedule}
                disabled={loading || selectedSlots.size === 0}
                className="bg-orange-500 hover:bg-orange-600"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Saving...
                  </>
                ) : (
                  <>
                    <Check className="w-4 h-4 mr-2" />
                    Save Schedule
                  </>
                )}
              </Button>
            </div>

            {/* Schedule Grid */}
            <div className="border rounded-lg p-4 bg-white">
              <div className="grid grid-cols-8 gap-2">
                {/* Header row */}
                <div className="font-semibold text-sm text-gray-700"></div>
                {DAYS.map((day, idx) => (
                  <div key={day} className="font-semibold text-xs text-center text-gray-700">
                    {day.substring(0, 3)}
                  </div>
                ))}

                {/* Time slots */}
                {HOURS.map((hour) => (
                  <div key={hour} className="contents">
                    <div className="text-xs text-gray-600 py-2">
                      {hour <= 12 ? `${hour}:00 ${hour < 12 ? 'AM' : 'PM'}` : `${hour - 12}:00 PM`}
                    </div>
                    {DAYS.map((_, dayIdx) => {
                      const key = `${dayIdx}-${hour}`
                      const isSelected = selectedSlots.has(key)
                      return (
                        <button
                          key={key}
                          type="button"
                          onClick={() => toggleSlot(dayIdx, hour)}
                          className={`
                            h-8 rounded border transition-all
                            ${isSelected
                              ? 'bg-orange-500 border-orange-600 hover:bg-orange-600'
                              : 'bg-white border-gray-300 hover:bg-gray-50'
                            }
                          `}
                        />
                      )
                    })}
                  </div>
                ))}
              </div>
              <p className="text-xs text-gray-500 mt-3">
                Selected {selectedSlots.size} time slot(s). Click cells to toggle availability.
              </p>
            </div>
          </div>
        )}

        {/* Summary */}
        <div className="border-t pt-4">
          <div className="flex items-center justify-between text-sm">
            <span className="text-gray-600">
              Completed: {onboardingTasks.filter((t) => t.isCompleted).length} / {onboardingTasks.length} tasks
            </span>
            <Badge
              variant={scheduleCompleted ? 'default' : 'outline'}
              className={scheduleCompleted ? 'bg-green-100 text-green-700' : ''}
            >
              Schedule: {scheduleCompleted ? 'Completed' : 'Pending'}
            </Badge>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

