'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { useToast } from '@/components/ui/toast'

export default function ImportClientsSection({ onImported }: { onImported: () => void }) {
  const { showToast } = useToast()
  const [csv, setCsv] = useState('')
  const [busy, setBusy] = useState(false)
  const [preview, setPreview] = useState<unknown>(null)

  const parsePreview = async () => {
    setBusy(true)
    try {
      const res = await fetch('/api/admin/clients/import', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode: 'preview', csv }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Preview failed')
      setPreview(data)
      showToast('Preview ready', 'success')
    } catch (e) {
      showToast(`Preview failed: ${String(e)}`, 'error')
    } finally {
      setBusy(false)
    }
  }

  const commit = async () => {
    setBusy(true)
    try {
      const res = await fetch('/api/admin/clients/import', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode: 'commit', csv }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Import failed')
      showToast(`Imported ${data.created ?? 0} clients`, 'success')
      setCsv('')
      setPreview(null)
      onImported()
    } catch (e) {
      showToast(`Import failed: ${String(e)}`, 'error')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="rounded-xl border border-dashed border-orange-300 bg-orange-50/40 dark:bg-orange-950/20 p-4 space-y-3">
      <h3 className="font-semibold text-gray-900 dark:text-[var(--text-primary)]">Bulk import (CSV)</h3>
      <p className="text-sm text-gray-600">
        Columns: first name, last name, status, city, state, zip, insurance provider, auth end date,
        assigned RBT name, assigned BCBA name
      </p>
      <div>
        <Label>Paste CSV</Label>
        <textarea
          className="mt-1 w-full min-h-[120px] rounded-md border bg-background px-3 py-2 text-sm font-mono"
          value={csv}
          onChange={(e) => setCsv(e.target.value)}
          placeholder="firstName,lastName,status,city,state,zip,..."
        />
      </div>
      <div className="flex gap-2 flex-wrap">
        <Button type="button" variant="secondary" disabled={busy || !csv.trim()} onClick={parsePreview}>
          Parse &amp; preview
        </Button>
        <Button
          type="button"
          className="bg-orange-600 hover:bg-orange-700"
          disabled={busy || !csv.trim()}
          onClick={commit}
        >
          Commit import
        </Button>
      </div>
      {preview != null && (
        <pre className="text-xs bg-gray-100 dark:bg-gray-900 p-3 rounded-md overflow-auto max-h-48">
          {JSON.stringify(preview, null, 2)}
        </pre>
      )}
    </div>
  )
}
