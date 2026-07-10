'use client'

import { useCallback, useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Upload, Loader2, FileSpreadsheet } from 'lucide-react'
import type { Session } from '@/lib/artemis/types'
import sampleSessions from '@/lib/artemis/__fixtures__/sample-metrics.json'

export interface UploadResult {
  sessions: Session[]
  hasRealMoney: boolean
  source: string
  rowCount: number
}

interface UploadPanelProps {
  open: boolean
  onClose: () => void
  onLoaded: (result: UploadResult) => void
}

export default function UploadPanel({ open, onClose, onLoaded }: UploadPanelProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [dragging, setDragging] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleFile = useCallback(
    async (file: File) => {
      setError(null)
      setLoading(true)
      try {
        const form = new FormData()
        form.append('file', file)
        const res = await fetch('/api/operations/reconcile', {
          method: 'POST',
          body: form,
          credentials: 'include',
        })
        const data = await res.json().catch(() => ({}))
        if (!res.ok) {
          const msg =
            res.status === 401
              ? 'Please sign in first'
              : res.status === 403
                ? 'Your account does not have Operations access'
                : data.error || 'Upload failed'
          throw new Error(msg)
        }
        onLoaded({
          sessions: data.sessions,
          hasRealMoney: data.hasRealMoney,
          source: data.source,
          rowCount: data.rowCount,
        })
        onClose()
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Upload failed')
      } finally {
        setLoading(false)
      }
    },
    [onClose, onLoaded]
  )

  const loadSample = () => {
    onLoaded({
      sessions: sampleSessions as Session[],
      hasRealMoney: false,
      source: 'Sample data',
      rowCount: (sampleSessions as Session[]).length,
    })
    onClose()
  }

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40">
      <div className="bg-white dark:bg-gray-900 rounded-lg shadow-xl max-w-lg w-full p-6">
        <h2 className="text-lg font-semibold mb-1">Upload Artemis export</h2>
        <p className="text-sm text-gray-500 mb-4">
          Reports → Claim Management → Session Reconciliation report → export to Excel
        </p>

        <div
          role="button"
          tabIndex={0}
          onDragOver={(e) => {
            e.preventDefault()
            setDragging(true)
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={(e) => {
            e.preventDefault()
            setDragging(false)
            const f = e.dataTransfer.files[0]
            if (f) void handleFile(f)
          }}
          onClick={() => inputRef.current?.click()}
          onKeyDown={(e) => e.key === 'Enter' && inputRef.current?.click()}
          className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors ${
            dragging
              ? 'border-[#0D9488] bg-teal-50 dark:bg-teal-950/20'
              : 'border-gray-300 dark:border-gray-600 hover:border-[#0D9488]'
          }`}
        >
          {loading ? (
            <Loader2 className="w-10 h-10 mx-auto text-[#0D9488] animate-spin" />
          ) : (
            <Upload className="w-10 h-10 mx-auto text-gray-400 mb-2" />
          )}
          <p className="text-sm font-medium">
            {loading ? 'Parsing spreadsheet…' : 'Drop .xlsx / .xls here or click to browse'}
          </p>
          <input
            ref={inputRef}
            type="file"
            accept=".xlsx,.xls"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0]
              if (f) void handleFile(f)
            }}
          />
        </div>

        {error && <p className="mt-3 text-sm text-red-600">{error}</p>}

        <div className="mt-4 flex flex-wrap gap-2 justify-between items-center">
          <Button type="button" variant="outline" size="sm" onClick={loadSample}>
            <FileSpreadsheet className="w-4 h-4 mr-1" />
            Load sample data
          </Button>
          <Button type="button" variant="ghost" size="sm" onClick={onClose}>
            Cancel
          </Button>
        </div>
      </div>
    </div>
  )
}
