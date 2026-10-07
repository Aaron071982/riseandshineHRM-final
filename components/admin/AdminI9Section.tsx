'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { useToast } from '@/components/ui/toast'
import { Loader2 } from 'lucide-react'
import { I9_SECTION2_DEADLINE_BUSINESS_DAYS } from '@/lib/onboarding/catalog'

function todayIso(): string {
  return new Date().toISOString().slice(0, 10)
}

function fmt(value: string | null): string {
  return value ? new Date(value).toLocaleDateString('en-US', { timeZone: 'America/New_York' }) : ''
}

export default function AdminI9Section({
  rbtProfileId,
  section1CompletedAt,
  section2CompletedAt,
  section2Notes,
}: {
  rbtProfileId: string
  section1CompletedAt: string | null
  section2CompletedAt: string | null
  section2Notes: string | null
}) {
  const { showToast } = useToast()
  const [saving, setSaving] = useState<1 | 2 | null>(null)
  const [s1Date, setS1Date] = useState(todayIso())
  const [s2Date, setS2Date] = useState(todayIso())
  const [s2Docs, setS2Docs] = useState('')

  const record = async (section: 1 | 2) => {
    setSaving(section)
    try {
      const res = await fetch(`/api/admin/rbts/${rbtProfileId}/onboarding/i9`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          section,
          completedAt: section === 1 ? s1Date : s2Date,
          notes: section === 2 ? s2Docs : undefined,
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || 'Failed')
      showToast(`I-9 Section ${section} recorded`, 'success')
      window.location.reload()
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'Failed', 'error')
    } finally {
      setSaving(null)
    }
  }

  return (
    <div className="space-y-3 border-t pt-4">
      <div>
        <p className="font-medium">Form I-9 (Employment Eligibility Verification)</p>
        <p className="text-xs text-gray-500">
          Section 1 is due by the first day of work; Section 2 within {I9_SECTION2_DEADLINE_BUSINESS_DAYS}{' '}
          business days of hire. Complete only when both are recorded.
        </p>
      </div>

      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <p className="text-sm font-medium">Section 1 — employee</p>
          <p className="text-sm text-gray-500">
            {section1CompletedAt ? `Completed ${fmt(section1CompletedAt)}` : 'Not received'}
          </p>
        </div>
        {!section1CompletedAt && (
          <div className="flex items-end gap-2">
            <div>
              <Label htmlFor="i9-s1-date" className="text-xs">Received on (paper form)</Label>
              <Input
                id="i9-s1-date"
                type="date"
                value={s1Date}
                max={todayIso()}
                onChange={(e) => setS1Date(e.target.value)}
                className="h-8 w-40"
              />
            </div>
            <Button size="sm" variant="outline" onClick={() => record(1)} disabled={saving !== null}>
              {saving === 1 ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Record Section 1'}
            </Button>
          </div>
        )}
      </div>

      <div className="space-y-2">
        <div>
          <p className="text-sm font-medium">Section 2 — employer document review</p>
          <p className="text-sm text-gray-500">
            {section2CompletedAt
              ? `Completed ${fmt(section2CompletedAt)}${section2Notes ? ` · ${section2Notes}` : ''}`
              : section1CompletedAt
                ? 'Pending employer review'
                : 'Waiting on Section 1'}
          </p>
        </div>
        {!section2CompletedAt && section1CompletedAt && (
          <div className="space-y-2 rounded-md border p-3">
            <div>
              <Label htmlFor="i9-s2-docs" className="text-xs">
                Documents examined (List A, or List B + List C) *
              </Label>
              <Textarea
                id="i9-s2-docs"
                rows={2}
                placeholder="e.g. List A: U.S. Passport, exp. 2031-04-02"
                value={s2Docs}
                onChange={(e) => setS2Docs(e.target.value)}
              />
            </div>
            <div className="flex items-end gap-2">
              <div>
                <Label htmlFor="i9-s2-date" className="text-xs">Examined on</Label>
                <Input
                  id="i9-s2-date"
                  type="date"
                  value={s2Date}
                  max={todayIso()}
                  onChange={(e) => setS2Date(e.target.value)}
                  className="h-8 w-40"
                />
              </div>
              <Button size="sm" onClick={() => record(2)} disabled={saving !== null || !s2Docs.trim()}>
                {saving === 2 ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Complete Section 2'}
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
