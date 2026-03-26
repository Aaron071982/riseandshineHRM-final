'use client'

import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import type { ApplicationData } from './types'

interface ApplicationStepComplianceProps {
  data: ApplicationData
  setData: React.Dispatch<React.SetStateAction<ApplicationData>>
}

export default function ApplicationStepCompliance({ data, setData }: ApplicationStepComplianceProps) {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold mb-2">Compliance & Eligibility</h2>
        <p className="text-gray-600">Please confirm your eligibility and compliance requirements.</p>
      </div>
      <div className="space-y-6">
        <div>
          <Label htmlFor="authorizedToWork">Are you authorized to work in the US? *</Label>
          <Select
            value={data.authorizedToWork}
            onValueChange={(value) => setData({ ...data, authorizedToWork: value })}
          >
            <SelectTrigger>
              <SelectValue placeholder="Select..." />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="true">Yes</SelectItem>
              <SelectItem value="false">No</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label htmlFor="canPassBackgroundCheck">Can you pass a background check? *</Label>
          <Select
            value={data.canPassBackgroundCheck}
            onValueChange={(value) => setData({ ...data, canPassBackgroundCheck: value })}
          >
            <SelectTrigger>
              <SelectValue placeholder="Select..." />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="true">Yes</SelectItem>
              <SelectItem value="false">No</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label htmlFor="cprFirstAidCertified">CPR/First Aid Certified?</Label>
          <Select
            value={data.cprFirstAidCertified}
            onValueChange={(value) => setData({ ...data, cprFirstAidCertified: value })}
          >
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
        <div>
          <Label htmlFor="notes">Additional Notes (Optional)</Label>
          <Textarea
            id="notes"
            rows={4}
            value={data.notes}
            onChange={(e) => setData({ ...data, notes: e.target.value })}
            placeholder="Any additional information you'd like to share..."
          />
        </div>
      </div>
    </div>
  )
}
