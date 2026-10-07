'use client'

import { useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2, Upload } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useToast } from '@/components/ui/toast'
import { USCIS_I9_FORM_URL } from '@/lib/onboarding/catalog'
import {
  I9_LIST_A,
  I9_LIST_B,
  I9_LIST_C,
  USCIS_I9_ACCEPTABLE_DOCUMENTS_URL,
} from '@/lib/compliance/i9AcceptableDocuments'

const linkClass = 'text-[#e36f1e] underline'

export function I9FormInstructions() {
  return (
    <div className="space-y-2 text-sm text-gray-700 dark:text-[var(--text-secondary)]">
      <p>
        Federal law requires every employee in the United States to complete Form I-9, Employment
        Eligibility Verification.
      </p>
      <ol className="list-decimal space-y-1 pl-5">
        <li>
          Download the current Form I-9 from{' '}
          <a href={USCIS_I9_FORM_URL} target="_blank" rel="noopener noreferrer" className={linkClass}>
            uscis.gov/i-9
          </a>
          .
        </li>
        <li>Fill out and sign Section 1 only. Leave Section 2 blank — HR completes it.</li>
        <li>Upload the completed form here.</li>
        <li>
          Upload your identity and work-authorization documents: either <strong>one document from List A</strong>,{' '}
          <em>or</em> <strong>one from List B plus one from List C</strong>. Which acceptable documents you
          present is entirely your choice.
        </li>
      </ol>
      <p>
        Please upload documents only through this secure portal — do not email photos or scans of your
        documents.
      </p>
    </div>
  )
}

function DocList({ title, subtitle, items }: { title: string; subtitle: string; items: readonly string[] }) {
  return (
    <details className="rounded-lg border border-gray-200 bg-white p-3 dark:border-[var(--border-subtle)] dark:bg-[var(--bg-elevated)]">
      <summary className="cursor-pointer text-sm font-semibold text-gray-900 dark:text-[var(--text-primary)]">
        {title} <span className="font-normal text-gray-500">— {subtitle}</span>
      </summary>
      <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-gray-700 dark:text-[var(--text-secondary)]">
        {items.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
    </details>
  )
}

export function I9AcceptableDocumentsList() {
  return (
    <div className="space-y-2">
      <p className="text-sm font-medium text-gray-900 dark:text-[var(--text-primary)]">
        Lists of acceptable documents
      </p>
      <DocList title="List A" subtitle="proves both identity and employment authorization" items={I9_LIST_A} />
      <DocList title="List B" subtitle="proves identity" items={I9_LIST_B} />
      <DocList title="List C" subtitle="proves employment authorization" items={I9_LIST_C} />
      <p className="text-xs text-gray-500">
        All documents must be unexpired. Certain receipts are also acceptable — see the{' '}
        <a
          href={USCIS_I9_ACCEPTABLE_DOCUMENTS_URL}
          target="_blank"
          rel="noopener noreferrer"
          className={linkClass}
        >
          USCIS acceptable documents page
        </a>
        .
      </p>
    </div>
  )
}

export function I9SupportingDocumentsUpload({ onUploaded }: { onUploaded?: () => void }) {
  const { showToast } = useToast()
  const router = useRouter()
  const inputRef = useRef<HTMLInputElement>(null)
  const [files, setFiles] = useState<File[]>([])
  const [loading, setLoading] = useState(false)

  const upload = async () => {
    if (files.length === 0) return
    setLoading(true)
    try {
      const fd = new FormData()
      for (const f of files) fd.append('files', f)
      const res = await fetch('/api/rbt/i9/documents', {
        method: 'POST',
        body: fd,
        credentials: 'include',
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        showToast(data.error || 'Upload failed', 'error')
        return
      }
      showToast(`Uploaded ${data.count} document${data.count === 1 ? '' : 's'}`, 'success')
      setFiles([])
      if (inputRef.current) inputRef.current.value = ''
      onUploaded?.()
      router.refresh()
    } catch {
      showToast('Upload failed', 'error')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-3">
      <input
        ref={inputRef}
        type="file"
        multiple
        accept=".pdf,.png,.jpg,.jpeg,.heic,.webp,application/pdf,image/*"
        onChange={(e) => setFiles(Array.from(e.target.files ?? []))}
        className="block w-full text-sm"
      />
      <p className="text-xs text-gray-500">PDF or photo, up to 10MB each. Front and back where applicable.</p>
      <Button
        type="button"
        onClick={upload}
        disabled={files.length === 0 || loading}
        className="bg-[#e36f1e] hover:bg-[#c95e18]"
      >
        {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Upload className="mr-2 h-4 w-4" />}
        Upload {files.length > 1 ? `${files.length} documents` : 'document'}
      </Button>
    </div>
  )
}
