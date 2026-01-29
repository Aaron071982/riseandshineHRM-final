'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { Label } from '@/components/ui/label'
import {
  SCORECARD_CATEGORIES,
  SCORECARD_CATEGORY_LABELS,
  type ScorecardCategory,
} from '@/lib/scorecard'
import { Check } from 'lucide-react'

interface ScorecardProps {
  interviewId: string
  onSave?: () => void
}

interface ScorecardData {
  scores: Record<string, number>
  comments: Record<string, string>
  overallScore: number
  ratedCount: number
}

const DEBOUNCE_MS = 500

export default function Scorecard({ interviewId, onSave }: ScorecardProps) {
  const [data, setData] = useState<ScorecardData | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [savedIndicator, setSavedIndicator] = useState(false)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const fetchScorecard = useCallback(async () => {
    try {
      const res = await fetch(`/api/admin/interviews/${interviewId}/scorecard`)
      if (!res.ok) {
        setData(null)
        return
      }
      const json = await res.json()
      if (json.scorecard) {
        setData({
          scores: json.scorecard.scores || {},
          comments: json.scorecard.comments || {},
          overallScore: json.scorecard.overallScore ?? 0,
          ratedCount: json.scorecard.ratedCount ?? 0,
        })
      } else {
        setData({
          scores: {},
          comments: {},
          overallScore: 0,
          ratedCount: 0,
        })
      }
    } catch {
      setData(null)
    } finally {
      setLoading(false)
    }
  }, [interviewId])

  useEffect(() => {
    fetchScorecard()
  }, [fetchScorecard])

  const persistScorecard = useCallback(
    async (scores: Record<string, number>, comments: Record<string, string>) => {
      setSaving(true)
      try {
        const res = await fetch(`/api/admin/interviews/${interviewId}/scorecard`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ scores, comments }),
        })
        if (res.ok) {
          const json = await res.json()
          if (json.scorecard) {
            setData((prev) =>
              prev
                ? {
                    ...prev,
                    scores: json.scorecard.scores || {},
                    comments: json.scorecard.comments || {},
                    overallScore: json.scorecard.overallScore ?? 0,
                    ratedCount: json.scorecard.ratedCount ?? 0,
                  }
                : null
            )
          }
          setSavedIndicator(true)
          onSave?.()
          setTimeout(() => setSavedIndicator(false), 2000)
        }
      } catch {
        // silent fail for auto-save
      } finally {
        setSaving(false)
      }
    },
    [interviewId, onSave]
  )

  const debouncedPersist = useCallback(
    (scores: Record<string, number>, comments: Record<string, string>) => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
      debounceRef.current = setTimeout(() => {
        debounceRef.current = null
        persistScorecard(scores, comments)
      }, DEBOUNCE_MS)
    },
    [persistScorecard]
  )

  const setScore = (category: ScorecardCategory, value: number) => {
    const scores = { ...(data?.scores ?? {}), [category]: value }
    const comments = data?.comments ?? {}
    const vals = Object.values(scores).filter((v) => v >= 1 && v <= 5)
    const overallScore =
      vals.length > 0
        ? Math.round((vals.reduce((a, b) => a + b, 0) / vals.length) * 10) / 10
        : 0
    const ratedCount = vals.length
    setData((prev) => ({
      scores,
      comments: prev?.comments ?? {},
      overallScore,
      ratedCount,
    }))
    debouncedPersist(scores, comments)
  }

  const setComment = (category: ScorecardCategory, value: string) => {
    const comments = { ...(data?.comments ?? {}), [category]: value }
    const scores = data?.scores ?? {}
    setData((prev) => {
      if (!prev) return { scores: {}, comments, overallScore: 0, ratedCount: 0 }
      const vals = Object.values(prev.scores).filter((v) => v >= 1 && v <= 5)
      const overallScore =
        vals.length > 0
          ? Math.round((vals.reduce((a, b) => a + b, 0) / vals.length) * 10) / 10
          : 0
      return { ...prev, comments, overallScore, ratedCount: vals.length }
    })
    debouncedPersist(scores, comments)
  }

  const [expandedComment, setExpandedComment] = useState<ScorecardCategory | null>(null)

  if (loading) {
    return (
      <div className="flex items-center justify-center py-6 text-sm text-gray-500">
        Loading scorecard...
      </div>
    )
  }

  const scores = data?.scores ?? {}
  const comments = data?.comments ?? {}
  const overallScore = data?.overallScore ?? 0
  const ratedCount = data?.ratedCount ?? 0

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-4">
        <p className="text-sm text-gray-600">
          Overall: {ratedCount > 0 ? `${overallScore} / 5` : '—'} ({ratedCount} categories rated)
        </p>
        <div className="flex items-center gap-2">
          {saving && (
            <span className="text-xs text-gray-500">Saving...</span>
          )}
          {savedIndicator && !saving && (
            <span className="flex items-center gap-1 text-xs text-green-600">
              <Check className="h-3 w-3" /> Saved
            </span>
          )}
        </div>
      </div>

      <div className="space-y-4">
        {SCORECARD_CATEGORIES.map((category) => (
          <div key={category} className="space-y-2">
            <div className="flex flex-wrap items-center gap-3">
              <Label className="min-w-[180px] text-sm font-medium text-gray-700">
                {SCORECARD_CATEGORY_LABELS[category]}
              </Label>
              <div className="flex gap-1" role="group" aria-label={`Rate ${SCORECARD_CATEGORY_LABELS[category]}`}>
                {([1, 2, 3, 4, 5] as const).map((n) => {
                  const selected = scores[category] === n
                  return (
                    <button
                      key={n}
                      type="button"
                      aria-pressed={selected}
                      onClick={() => setScore(category, n)}
                      className={`min-w-[2rem] rounded-full border px-2.5 py-1 text-sm font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-orange-500 focus:ring-offset-1 ${
                        selected
                          ? 'border-orange-500 bg-orange-500 text-white hover:bg-orange-600'
                          : 'border-gray-300 bg-white text-gray-700 hover:border-gray-400'
                      }`}
                    >
                      {n}
                    </button>
                  )
                })}
              </div>
              <button
                type="button"
                onClick={() =>
                  setExpandedComment(expandedComment === category ? null : category)
                }
                className="text-xs text-orange-600 hover:text-orange-700"
              >
                {comments[category] || expandedComment === category ? 'Edit comment' : 'Add comment'}
              </button>
            </div>
            {expandedComment === category && (
              <input
                type="text"
                value={comments[category] ?? ''}
                onChange={(e) => setComment(category, e.target.value)}
                onBlur={() => setExpandedComment(null)}
                placeholder="Optional comment..."
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                autoFocus
              />
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
