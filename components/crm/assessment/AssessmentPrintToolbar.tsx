'use client'

import { useEffect } from 'react'

export function AssessmentPrintToolbar({
  clientId,
  assessmentId,
}: {
  clientId: string
  assessmentId: string
}) {
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    if (params.get('auto') === '1') {
      const t = window.setTimeout(() => window.print(), 400)
      return () => window.clearTimeout(t)
    }
  }, [])

  return (
    <div className="assessment-print-toolbar no-print">
      <button type="button" onClick={() => window.print()}>
        Save as PDF / Print
      </button>
      <button
        type="button"
        className="secondary"
        onClick={() =>
          window.open(
            `/client-services/clients/${clientId}/assessments/${assessmentId}`,
            '_self'
          )
        }
      >
        Back to form
      </button>
    </div>
  )
}
