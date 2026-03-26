'use client'

import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Checkbox } from '@/components/ui/checkbox'
import type { ApplicationData } from './types'

interface ApplicationStepRBTReadinessProps {
  data: ApplicationData
  setData: React.Dispatch<React.SetStateAction<ApplicationData>>
}

export default function ApplicationStepRBTReadiness({ data, setData }: ApplicationStepRBTReadinessProps) {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold mb-2 text-gray-900">RBT Readiness</h2>
        <p className="text-gray-600">Tell us about your RBT qualifications and experience.</p>
      </div>
      <div className="space-y-6">
        <div>
          <Label htmlFor="fortyHourCourseCompleted">40-Hour RBT Course Already Completed? *</Label>
          <Select
            value={data.fortyHourCourseCompleted}
            onValueChange={(value) => setData({ ...data, fortyHourCourseCompleted: value })}
          >
            <SelectTrigger>
              <SelectValue placeholder="Select..." />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="true">Yes</SelectItem>
              <SelectItem value="false">No</SelectItem>
            </SelectContent>
          </Select>
          {data.fortyHourCourseCompleted === 'false' && (
            <p className="text-sm text-gray-500 mt-2">
              If &quot;No&quot;, you will need to complete the 40-hour course and upload the certificate during onboarding.
            </p>
          )}
        </div>
        <div>
          <Label htmlFor="experienceYears">Years of Experience</Label>
          <Select
            value={data.experienceYears}
            onValueChange={(value) => setData({ ...data, experienceYears: value })}
          >
            <SelectTrigger>
              <SelectValue placeholder="Select..." />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="0">0 years</SelectItem>
              <SelectItem value="1">1 year</SelectItem>
              <SelectItem value="2">2 years</SelectItem>
              <SelectItem value="3">3 years</SelectItem>
              <SelectItem value="4">4 years</SelectItem>
              <SelectItem value="5">5 years</SelectItem>
              <SelectItem value="6-10">6-10 years</SelectItem>
              <SelectItem value="10+">10+ years</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label>Preferred Client Age Groups</Label>
          <div className="space-y-2 mt-2">
            {['Toddler (2-4)', 'Preschool (4-6)', 'Elementary (6-10)', 'Pre-teen (10-13)', 'Teen (13+)'].map((age) => (
              <div key={age} className="flex items-center space-x-2">
                <Checkbox
                  id={`age-${age}`}
                  checked={data.preferredAgeGroups.includes(age)}
                  onCheckedChange={(checked) => {
                    if (checked) {
                      setData({ ...data, preferredAgeGroups: [...data.preferredAgeGroups, age] })
                    } else {
                      setData({ ...data, preferredAgeGroups: data.preferredAgeGroups.filter((a) => a !== age) })
                    }
                  }}
                />
                <Label htmlFor={`age-${age}`} className="font-normal cursor-pointer">
                  {age}
                </Label>
              </div>
            ))}
          </div>
        </div>
        <div>
          <Label>Languages Spoken</Label>
          <div className="space-y-2 mt-2">
            {['English', 'Spanish', 'French', 'Mandarin', 'Arabic', 'Other'].map((lang) => (
              <div key={lang} className="flex items-center space-x-2">
                <Checkbox
                  id={`lang-${lang}`}
                  checked={data.languages.includes(lang)}
                  onCheckedChange={(checked) => {
                    if (checked) {
                      setData({ ...data, languages: [...data.languages, lang] })
                    } else {
                      setData({ ...data, languages: data.languages.filter((l) => l !== lang) })
                    }
                  }}
                />
                <Label htmlFor={`lang-${lang}`} className="font-normal cursor-pointer">
                  {lang}
                </Label>
              </div>
            ))}
          </div>
          {data.languages.includes('Other') && (
            <Input
              className="mt-2"
              placeholder="Please specify"
              value={data.otherLanguage}
              onChange={(e) => setData({ ...data, otherLanguage: e.target.value })}
            />
          )}
        </div>
        <div>
          <Label htmlFor="transportation">Reliable Transportation?</Label>
          <Select
            value={data.transportation}
            onValueChange={(value) => setData({ ...data, transportation: value })}
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
      </div>
    </div>
  )
}
