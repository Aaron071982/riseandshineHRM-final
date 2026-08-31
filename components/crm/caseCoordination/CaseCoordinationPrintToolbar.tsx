'use client'

import { useEffect } from 'react'

export function CaseCoordinationPrintToolbar({
  clientId,
  recordId,
}: {
  clientId: string
  recordId: string
}) {
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    if (params.get('auto') === '1') {
      const t = window.setTimeout(() => window.print(), 400)
      return () => window.clearTimeout(t)
    }
  }, [])

  return (
    <div className="case-coord-toolbar no-print">
      <p style={{ background: '#fff', border: '1px solid #e8dfd6', borderRadius: 6, fontSize: 12, margin: 0, maxWidth: 220, padding: '8px 12px' }}>
        Enable <strong>Background graphics</strong> in the print dialog for orange/cyan headers.
      </p>
      <button type="button" onClick={() => window.print()}>
        Save as PDF / Print
      </button>
      <button
        type="button"
        className="secondary"
        onClick={() =>
          window.open(
            `/client-services/clients/${clientId}?tab=case-coordination`,
            '_self'
          )
        }
      >
        Back to client
      </button>
    </div>
  )
}
