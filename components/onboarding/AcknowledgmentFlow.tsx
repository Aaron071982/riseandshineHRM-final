'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { Dancing_Script } from 'next/font/google'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { useToast } from '@/components/ui/toast'
import { PER_DOCUMENT_SIGNATURE_CONSENT_STATEMENT } from '@/lib/esign-constants'
import type { AuditTrailEvent } from '@/lib/signature-certificate'

const dancingScript = Dancing_Script({ weight: '400', subsets: ['latin'] })

interface OnboardingDocument {
  id: string
  title: string
  slug: string
  type: 'ACKNOWLEDGMENT' | 'FILLABLE_PDF'
  pdfUrl: string | null
  pdfData: string | null
}

interface Completion {
  id: string
  documentId: string
  status: 'NOT_STARTED' | 'IN_PROGRESS' | 'COMPLETED'
  completedAt: string | null
}

interface AcknowledgmentFlowProps {
  document: OnboardingDocument
  completion: Completion | undefined
  onComplete: () => void
}

const DISPLAY_TZ = 'America/New_York'

function pushEvent(events: AuditTrailEvent[], event: Omit<AuditTrailEvent, 'timestamp'> & { timestamp?: string }) {
  const timestamp = event.timestamp ?? new Date().toISOString()
  return [...events, { ...event, timestamp } as AuditTrailEvent]
}

function twoOrMoreWords(s: string): boolean {
  return s.trim().split(/\s+/).filter(Boolean).length >= 2
}

export default function AcknowledgmentFlow({ document, completion, onComplete }: AcknowledgmentFlowProps) {
  const { showToast } = useToast()
  const [readConfirmed, setReadConfirmed] = useState(false)
  const [agreeConfirmed, setAgreeConfirmed] = useState(false)
  const [perDocConsent, setPerDocConsent] = useState(false)
  const [typedName, setTypedName] = useState('')
  const [hasScrolledToBottom, setHasScrolledToBottom] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)
  const [loading, setLoading] = useState(false)
  const [isCompleted, setIsCompleted] = useState(completion?.status === 'COMPLETED')
  const [auditTrail, setAuditTrail] = useState<AuditTrailEvent[]>([])
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [successInfo, setSuccessInfo] = useState<{ name: string; whenEastern: string } | null>(null)
  const openedRef = useRef(false)

  const todayLabel = new Date().toLocaleDateString('en-US', {
    timeZone: DISPLAY_TZ,
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })

  useEffect(() => {
    if (completion?.status === 'COMPLETED') {
      setIsCompleted(true)
    }
  }, [completion])

  useEffect(() => {
    if (isCompleted || openedRef.current) return
    openedRef.current = true
    let cancelled = false
    ;(async () => {
      let ipAddress: string | undefined
      let userAgent: string | undefined
      try {
        const res = await fetch('/api/rbt/client-info', { credentials: 'include' })
        if (res.ok) {
          const j = await res.json()
          ipAddress = j.ipAddress
          userAgent = j.userAgent
        }
      } catch {
        // optional
      }
      if (cancelled) return
      setAuditTrail((prev) =>
        pushEvent(prev, {
          action: 'DOCUMENT_OPENED',
          documentId: document.id,
          ...(ipAddress ? { ipAddress } : {}),
          ...(userAgent ? { userAgent } : {}),
        })
      )
    })()
    return () => {
      cancelled = true
    }
  }, [document.id, isCompleted])

  useEffect(() => {
    const container = containerRef.current
    if (!container || isCompleted) return

    const handleScroll = () => {
      const { scrollTop, scrollHeight, clientHeight } = container
      if (scrollTop + clientHeight >= scrollHeight - 10) {
        setHasScrolledToBottom(true)
        setAuditTrail((prev) => {
          if (prev.some((e) => e.action === 'DOCUMENT_SCROLLED_TO_BOTTOM')) return prev
          return pushEvent(prev, { action: 'DOCUMENT_SCROLLED_TO_BOTTOM', documentId: document.id })
        })
      }
    }

    container.addEventListener('scroll', handleScroll)
    return () => container.removeEventListener('scroll', handleScroll)
  }, [document.id, isCompleted])

  const onReadChange = useCallback(
    (checked: boolean) => {
      setReadConfirmed(checked)
      if (checked) {
        setAuditTrail((prev) =>
          pushEvent(prev, { action: 'CHECKBOX_CHECKED', checkboxId: 'read_and_reviewed', documentId: document.id })
        )
      }
    },
    [document.id]
  )

  const onAgreeChange = useCallback(
    (checked: boolean) => {
      setAgreeConfirmed(checked)
      if (checked) {
        setAuditTrail((prev) =>
          pushEvent(prev, { action: 'CHECKBOX_CHECKED', checkboxId: 'agree_terms', documentId: document.id })
        )
      }
    },
    [document.id]
  )

  const onPerDocConsentChange = useCallback(
    (checked: boolean) => {
      setPerDocConsent(checked)
      if (checked) {
        setAuditTrail((prev) =>
          pushEvent(prev, { action: 'CHECKBOX_CHECKED', checkboxId: 'per_document_esign_consent', documentId: document.id })
        )
      }
    },
    [document.id]
  )

  const canSubmit =
    readConfirmed &&
    agreeConfirmed &&
    perDocConsent &&
    twoOrMoreWords(typedName) &&
    hasScrolledToBottom

  const doSubmit = async () => {
    if (!canSubmit) return
    setLoading(true)
    setConfirmOpen(false)
    try {
      const signedAt = new Date()
      const trailWithSignature = pushEvent(auditTrail, {
        action: 'SIGNATURE_ENTERED',
        documentId: document.id,
        signatureText: typedName.trim(),
        timestamp: signedAt.toISOString(),
      })
      const response = await fetch('/api/onboarding/acknowledge', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          documentId: document.id,
          typedName: typedName.trim(),
          readConfirmed,
          agreeConfirmed,
          signatureConsentGiven: perDocConsent,
          consentStatement: PER_DOCUMENT_SIGNATURE_CONSENT_STATEMENT,
          auditTrail: trailWithSignature,
          timezone: DISPLAY_TZ,
        }),
      })

      if (response.ok) {
        const whenEastern = signedAt.toLocaleString('en-US', {
          timeZone: DISPLAY_TZ,
          dateStyle: 'full',
          timeStyle: 'short',
        })
        setSuccessInfo({ name: typedName.trim(), whenEastern })
        setIsCompleted(true)
        onComplete()
        showToast('Document signed successfully', 'success')
      } else {
        const error = await response.json()
        showToast(error.error || 'Failed to save acknowledgment', 'error')
      }
    } catch {
      showToast('An error occurred. Please try again.', 'error')
    } finally {
      setLoading(false)
    }
  }

  if (successInfo && isCompleted) {
    return (
      <Card className="dark:bg-[var(--bg-elevated)] dark:border-[var(--border-subtle)]">
        <CardContent className="pt-6 space-y-3">
          <p className="text-green-600 dark:text-green-400 font-semibold text-lg">Document signed successfully</p>
          <p className="text-gray-700 dark:text-[var(--text-secondary)]">
            Signed as: <span className={`font-medium ${dancingScript.className} text-xl`}>{successInfo.name}</span>
          </p>
          <p className="text-sm text-gray-600 dark:text-[var(--text-tertiary)]">Date: {successInfo.whenEastern}</p>
          <p className="text-sm text-gray-600 dark:text-[var(--text-tertiary)]">
            A record of this signature has been saved.
          </p>
        </CardContent>
      </Card>
    )
  }

  if (isCompleted && completion?.completedAt) {
    return (
      <Card>
        <CardContent className="pt-6">
          <div className="text-center space-y-4">
            <div className="text-green-600 font-semibold text-lg">
              Completed on {new Date(completion.completedAt).toLocaleDateString('en-US', { timeZone: DISPLAY_TZ })}
            </div>
            <p className="text-gray-600">This document has been completed and signed.</p>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-6">
      <Card className="dark:bg-[var(--bg-elevated)] dark:border-[var(--border-subtle)]">
        <CardContent className="pt-6">
          <div
            ref={containerRef}
            className="border rounded-lg overflow-auto max-h-[min(600px,70vh)] touch-pan-y"
            style={{ height: 'min(600px, 70vh)' }}
          >
            {document.pdfData ? (
              <iframe
                src={`data:application/pdf;base64,${document.pdfData}`}
                className="w-full h-full min-h-[400px]"
                title={document.title}
              />
            ) : document.pdfUrl ? (
              <iframe src={document.pdfUrl} className="w-full h-full min-h-[400px]" title={document.title} />
            ) : (
              <div className="flex items-center justify-center h-full min-h-[200px] text-gray-500">PDF not available</div>
            )}
          </div>
        </CardContent>
      </Card>

      <Card className="dark:bg-[var(--bg-elevated)] dark:border-[var(--border-subtle)]">
        <CardContent className="pt-6 space-y-6">
          <div className="space-y-4">
            <div className="flex items-start space-x-3">
              <Checkbox
                id="read-confirmed"
                checked={readConfirmed}
                onCheckedChange={(c) => onReadChange(c === true)}
                disabled={isCompleted}
              />
              <Label htmlFor="read-confirmed" className="cursor-pointer text-sm leading-snug">
                I have read and reviewed the entire document
                {hasScrolledToBottom ? <span className="text-green-600 ml-1">(scrolled to end)</span> : null}
              </Label>
            </div>

            <div className="flex items-start space-x-3">
              <Checkbox
                id="agree-confirmed"
                checked={agreeConfirmed}
                onCheckedChange={(c) => onAgreeChange(c === true)}
                disabled={isCompleted}
              />
              <Label htmlFor="agree-confirmed" className="cursor-pointer text-sm leading-snug">
                I agree to the terms and conditions stated in this document
              </Label>
            </div>

            <div className="flex items-start space-x-3 rounded-lg border border-slate-200 dark:border-slate-700 p-4 bg-slate-50/80 dark:bg-slate-900/40">
              <Checkbox
                id="per-doc-consent"
                checked={perDocConsent}
                onCheckedChange={(c) => onPerDocConsentChange(c === true)}
                disabled={isCompleted}
              />
              <Label htmlFor="per-doc-consent" className="cursor-pointer text-sm leading-snug font-normal">
                {PER_DOCUMENT_SIGNATURE_CONSENT_STATEMENT}
              </Label>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="typed-name" className="text-sm font-medium">
              Type your full legal name to sign
            </Label>
            <Input
              id="typed-name"
              value={typedName}
              onChange={(e) => setTypedName(e.target.value)}
              placeholder="Full legal name"
              disabled={isCompleted}
              className={`text-2xl md:text-3xl py-6 ${dancingScript.className}`}
              autoComplete="name"
            />
            {!twoOrMoreWords(typedName) && typedName.trim().length > 0 ? (
              <p className="text-xs text-amber-700 dark:text-amber-400">Enter your first and last name.</p>
            ) : null}
          </div>

          <p className="text-sm text-gray-700 dark:text-[var(--text-secondary)]">
            Date: <span className="font-medium">{todayLabel}</span>
            <span className="text-xs text-gray-500 block mt-1">(Today in Eastern Time — read-only)</span>
          </p>

          <Button
            type="button"
            className="w-full bg-[#e36f1e] hover:bg-[#c85e18] text-white"
            disabled={!canSubmit || loading || isCompleted}
            onClick={() => setConfirmOpen(true)}
          >
            {loading ? 'Signing…' : 'Sign document'}
          </Button>
        </CardContent>
      </Card>

      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Confirm electronic signature</DialogTitle>
            <DialogDescription>
              You are about to electronically sign <strong>{document.title}</strong>. This is a legally binding action.
              Are you sure?
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button type="button" variant="outline" onClick={() => setConfirmOpen(false)}>
              Cancel
            </Button>
            <Button type="button" className="bg-[#e36f1e] hover:bg-[#c85e18]" onClick={() => void doSubmit()} disabled={loading}>
              Sign now
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
