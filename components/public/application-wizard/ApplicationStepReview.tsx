'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'
import type { ApplicationData } from './types'

interface ApplicationStepReviewProps {
  data: ApplicationData
  consent: boolean
  onConsentChange: (checked: boolean) => void
}

export default function ApplicationStepReview({ data, consent, onConsentChange }: ApplicationStepReviewProps) {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold mb-2 text-gray-900">Review & Submit</h2>
        <p className="text-gray-600">Please review your information before submitting.</p>
      </div>
      <div className="space-y-6">
        <Card className="bg-white rounded-card border border-gray-200 shadow-sm">
          <CardHeader>
            <CardTitle className="font-semibold text-gray-900">Personal Information</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <p>
              <strong>Name:</strong> {data.firstName} {data.lastName}
            </p>
            <p>
              <strong>Gender:</strong> {data.gender || '—'}
            </p>
            <p>
              <strong>Email:</strong> {data.email}
            </p>
            <p>
              <strong>Phone:</strong> {data.phoneNumber}
            </p>
            <p>
              <strong>Address:</strong> {data.addressLine1} {data.addressLine2 && `, ${data.addressLine2}`}
            </p>
            <p>
              <strong>City, State ZIP:</strong> {data.city} {data.state} {data.zipCode}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>RBT Readiness</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <p>
              <strong>40-Hour Course Completed:</strong> {data.fortyHourCourseCompleted === 'true' ? 'Yes' : 'No'}
            </p>
            <p>
              <strong>Experience:</strong> {data.experienceYears || 'Not specified'}
            </p>
            <p>
              <strong>Preferred Age Groups:</strong> {data.preferredAgeGroups.length > 0 ? data.preferredAgeGroups.join(', ') : 'None'}
            </p>
            <p>
              <strong>Languages:</strong> {data.languages.length > 0 ? [...data.languages, data.otherLanguage].filter(Boolean).join(', ') : 'None'}
            </p>
            <p>
              <strong>Transportation:</strong> {data.transportation === 'true' ? 'Yes' : data.transportation === 'false' ? 'No' : 'Not specified'}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="font-semibold text-gray-900">Availability</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <p>
              <strong>Weekday Availability:</strong> {Object.keys(data.weekdayAvailability).filter((k) => data.weekdayAvailability[k]).join(', ') || 'None'}
            </p>
            <p>
              <strong>Weekend Availability:</strong> {Object.keys(data.weekendAvailability).filter((k) => data.weekendAvailability[k]).join(', ') || 'None'}
            </p>
            <p>
              <strong>Preferred Hours:</strong> {data.preferredHoursRange}
            </p>
            <p>
              <strong>Time Range:</strong> {data.earliestStartTime} - {data.latestEndTime}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Compliance</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <p>
              <strong>Authorized to Work:</strong> {data.authorizedToWork === 'true' ? 'Yes' : 'No'}
            </p>
            <p>
              <strong>Background Check:</strong> {data.canPassBackgroundCheck === 'true' ? 'Yes' : 'No'}
            </p>
            <p>
              <strong>CPR/First Aid:</strong> {data.cprFirstAidCertified || 'Not specified'}
            </p>
            {data.notes && (
              <p>
                <strong>Notes:</strong> {data.notes}
              </p>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="font-semibold text-gray-900">Documents</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <p>
              <strong>Resume:</strong> {data.resume ? data.resume.name : 'Not uploaded'}
            </p>
            <p>
              <strong>Government ID:</strong> {data.idDocument ? data.idDocument.name : 'Not uploaded'}
            </p>
            {data.rbtCertificate && (
              <p>
                <strong>RBT Certificate:</strong> {data.rbtCertificate.name}
              </p>
            )}
            {data.cprCard && (
              <p>
                <strong>CPR Card:</strong> {data.cprCard.name}
              </p>
            )}
          </CardContent>
        </Card>
        <div className="flex items-start space-x-2">
          <Checkbox id="consent" checked={consent} onCheckedChange={(checked) => onConsentChange(checked as boolean)} required />
          <Label htmlFor="consent" className="font-normal cursor-pointer">
            I confirm that the information provided is accurate and complete. I understand that providing false information may result in rejection of my application.
          </Label>
        </div>
      </div>
    </div>
  )
}
