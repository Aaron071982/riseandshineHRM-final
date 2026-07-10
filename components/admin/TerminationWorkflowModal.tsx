'use client'

import { useEffect, useMemo, useState } from 'react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Loader2, AlertTriangle } from 'lucide-react'
import { useToast } from '@/components/ui/toast'
import {
  TERMINATION_REASON_LABELS,
  DEFAULT_EHR_SYSTEM,
} from '@/lib/termination/constants'
import { computeTerminationDates, formatDateNY } from '@/lib/termination/dates'

const STEPS = ['Details', 'Final pay', 'Compliance'] as const

type Step = (typeof STEPS)[number]

interface TerminationWorkflowModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  rbtId: string
  displayName: string
  email?: string | null
  onFinalized?: (details: { reason: string; terminatedAt: string; terminationId: string }) => void
}

function toDateInput(d: Date): string {
  return d.toISOString().slice(0, 10)
}

export default function TerminationWorkflowModal({
  open,
  onOpenChange,
  rbtId,
  displayName,
  email,
  onFinalized,
}: TerminationWorkflowModalProps) {
  const { showToast } = useToast()
  const [step, setStep] = useState<Step>('Details')
  const [loading, setLoading] = useState(false)

  const [reason, setReason] = useState('PERFORMANCE')
  const [reasonNarrative, setReasonNarrative] = useState('')
  const [terminationDate, setTerminationDate] = useState(toDateInput(new Date()))
  const [lastDayWorked, setLastDayWorked] = useState(toDateInput(new Date()))
  const [counselConsulted, setCounselConsulted] = useState(false)
  const [benefitsEndDate, setBenefitsEndDate] = useState('')
  const [finalPayDate, setFinalPayDate] = useState('')
  const [noticeDeadline, setNoticeDeadline] = useState('')

  const [regularWages, setRegularWages] = useState('')
  const [overtimeOwed, setOvertimeOwed] = useState('')
  const [commissionsOwed, setCommissionsOwed] = useState('')
  const [ptoPayout, setPtoPayout] = useState('')
  const [deductions, setDeductions] = useState('')
  const [netFinalPay, setNetFinalPay] = useState('')

  const [reasonDocumented, setReasonDocumented] = useState(false)
  const [consistencyChecked, setConsistencyChecked] = useState(false)
  const [redFlagPresent, setRedFlagPresent] = useState(false)
  const [contractChecked, setContractChecked] = useState(false)
  const [ehrSystemName, setEhrSystemName] = useState(DEFAULT_EHR_SYSTEM)
  const [propertyList, setPropertyList] = useState('Laptop, badge, keys, company materials')
  const [coveragePlan, setCoveragePlan] = useState('')

  const computedDates = useMemo(() => {
    const d = new Date(terminationDate)
    if (Number.isNaN(d.getTime())) return null
    return computeTerminationDates(d)
  }, [terminationDate])

  useEffect(() => {
    if (!computedDates) return
    setBenefitsEndDate(toDateInput(computedDates.benefitsEndDate))
    setFinalPayDate(toDateInput(computedDates.finalPayDate))
    setNoticeDeadline(toDateInput(computedDates.noticeDeadline))
  }, [computedDates])

  const reset = () => {
    setStep('Details')
    setReason('PERFORMANCE')
    setReasonNarrative('')
    const today = toDateInput(new Date())
    setTerminationDate(today)
    setLastDayWorked(today)
    setCounselConsulted(false)
    setRegularWages('')
    setOvertimeOwed('')
    setCommissionsOwed('')
    setPtoPayout('')
    setDeductions('')
    setNetFinalPay('')
    setReasonDocumented(false)
    setConsistencyChecked(false)
    setRedFlagPresent(false)
    setContractChecked(false)
    setEhrSystemName(DEFAULT_EHR_SYSTEM)
    setPropertyList('Laptop, badge, keys, company materials')
    setCoveragePlan('')
  }

  const handleClose = (next: boolean) => {
    if (!loading) {
      if (!next) reset()
      onOpenChange(next)
    }
  }

  const canAdvanceDetails = reasonNarrative.trim().length > 0 && terminationDate && lastDayWorked
  const blockedByRedFlag = redFlagPresent && !counselConsulted
  const canFinalize =
    reasonDocumented && consistencyChecked && contractChecked && !blockedByRedFlag

  const handleFinalize = async () => {
    if (!canFinalize) {
      showToast('Complete the compliance checklist', 'error')
      return
    }
    setLoading(true)
    try {
      const res = await fetch(`/api/admin/rbts/${rbtId}/termination`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          reason,
          reasonNarrative: reasonNarrative.trim(),
          terminationDate,
          lastDayWorked,
          benefitsEndDate,
          finalPayDate,
          noticeDeadline,
          counselConsulted,
          reasonDocumented,
          consistencyChecked,
          redFlagPresent,
          contractChecked,
          regularWages,
          overtimeOwed,
          commissionsOwed,
          ptoPayout,
          deductions,
          netFinalPay,
          ehrSystemName,
          propertyList,
          coveragePlan,
        }),
      })
      let data = await res.json().catch(() => ({}))

      // Fallback: if full workflow tables are unavailable, use simple terminate
      if (!res.ok && (String(data.error || '').includes('terminations') || res.status === 500)) {
        const fallback = await fetch(`/api/admin/rbts/${rbtId}/terminate`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ reason: reasonNarrative.trim() }),
        })
        data = await fallback.json().catch(() => ({}))
        if (!fallback.ok) {
          showToast(data.error || 'Failed to finalize termination', 'error')
          return
        }
        showToast(`${displayName} terminated.`, 'success')
        handleClose(false)
        onFinalized?.({
          reason: reasonNarrative.trim(),
          terminatedAt: new Date().toISOString(),
          terminationId: '',
        })
        return
      }

      if (!res.ok) {
        showToast(data.error || 'Failed to finalize termination', 'error')
        return
      }
      showToast(`${displayName} terminated. Offboarding tasks created.`, 'success')
      handleClose(false)
      onFinalized?.({
        reason: reasonNarrative.trim(),
        terminatedAt: new Date().toISOString(),
        terminationId: data.terminationId,
      })
    } catch {
      showToast('Failed to finalize termination', 'error')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Terminate {displayName}</DialogTitle>
          <DialogDescription>
            Step {STEPS.indexOf(step) + 1} of {STEPS.length}: {step}
            {!email?.trim() && (
              <span className="block text-red-600 mt-1">Employee email is required on file.</span>
            )}
          </DialogDescription>
        </DialogHeader>

        {step === 'Details' && (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Reason category</Label>
              <Select value={reason} onValueChange={setReason}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(TERMINATION_REASON_LABELS).map(([value, label]) => (
                    <SelectItem key={value} value={value}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="reason-narrative">Summary of basis (required)</Label>
              <Textarea
                id="reason-narrative"
                value={reasonNarrative}
                onChange={(e) => setReasonNarrative(e.target.value)}
                placeholder="Document the specific basis for termination…"
                rows={4}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="termination-date">Termination date</Label>
                <Input
                  id="termination-date"
                  type="date"
                  value={terminationDate}
                  onChange={(e) => setTerminationDate(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="last-day">Last day worked</Label>
                <Input
                  id="last-day"
                  type="date"
                  value={lastDayWorked}
                  onChange={(e) => setLastDayWorked(e.target.value)}
                />
              </div>
            </div>
            {computedDates && (
              <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm space-y-1 dark:bg-[var(--status-warning-bg)] dark:border-[var(--status-warning-border)]">
                <p>
                  <strong>§195(6) notice deadline:</strong>{' '}
                  {formatDateNY(computedDates.noticeDeadline)} (5 working days)
                </p>
                <p>
                  <strong>Benefits end (default):</strong> {formatDateNY(computedDates.benefitsEndDate)}
                </p>
                <p>
                  <strong>Final pay date (default):</strong> {formatDateNY(computedDates.finalPayDate)}
                </p>
              </div>
            )}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="benefits-end">Benefits end date</Label>
                <Input id="benefits-end" type="date" value={benefitsEndDate} onChange={(e) => setBenefitsEndDate(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="final-pay">Final pay date</Label>
                <Input id="final-pay" type="date" value={finalPayDate} onChange={(e) => setFinalPayDate(e.target.value)} />
              </div>
            </div>
            <label className="flex items-center gap-2 text-sm">
              <Checkbox checked={counselConsulted} onCheckedChange={(v) => setCounselConsulted(v === true)} />
              Employment counsel consulted
            </label>
          </div>
        )}

        {step === 'Final pay' && (
          <div className="space-y-3">
            <p className="text-sm text-gray-600">
              PTO is owed unless a written forfeiture policy was communicated in advance. Final pay is due on or before the next regular payday (NY Labor Law §191).
            </p>
            {[
              ['Regular wages', regularWages, setRegularWages],
              ['Overtime owed', overtimeOwed, setOvertimeOwed],
              ['Commissions owed', commissionsOwed, setCommissionsOwed],
              ['Accrued PTO payout', ptoPayout, setPtoPayout],
              ['Deductions', deductions, setDeductions],
              ['Net final pay', netFinalPay, setNetFinalPay],
            ].map(([label, val, setter]) => (
              <div key={label as string} className="space-y-1">
                <Label>{label as string}</Label>
                <Input value={val as string} onChange={(e) => (setter as (v: string) => void)(e.target.value)} placeholder="$0.00" />
              </div>
            ))}
            <div className="space-y-2">
              <Label>EHR / PHI system</Label>
              <Input value={ehrSystemName} onChange={(e) => setEhrSystemName(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Company property to collect</Label>
              <Input value={propertyList} onChange={(e) => setPropertyList(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Client coverage / reassignment plan</Label>
              <Textarea value={coveragePlan} onChange={(e) => setCoveragePlan(e.target.value)} rows={2} placeholder="Who covers caseload?" />
            </div>
          </div>
        )}

        {step === 'Compliance' && (
          <div className="space-y-4">
            <p className="text-sm text-gray-600">Confirm each item before finalizing. This creates the termination record, offboarding tasks, and document packet.</p>
            {[
              ['Reason is documented in the file', reasonDocumented, setReasonDocumented],
              ['Decision is consistent with handbook and past practice', consistencyChecked, setConsistencyChecked],
              ['No offer letter or policy alters at-will status', contractChecked, setContractChecked],
              [
                'Red-flag timing (recent leave, complaint, claim, or protected activity)',
                redFlagPresent,
                setRedFlagPresent,
              ],
            ].map(([label, checked, setter]) => (
              <label key={label as string} className="flex items-start gap-2 text-sm">
                <Checkbox
                  className="mt-0.5"
                  checked={checked as boolean}
                  onCheckedChange={(v) => (setter as (b: boolean) => void)(v === true)}
                />
                <span>{label as string}</span>
              </label>
            ))}
            {blockedByRedFlag && (
              <div className="flex gap-2 rounded-md border border-red-300 bg-red-50 p-3 text-sm text-red-800 dark:bg-[var(--status-rejected-bg)] dark:border-[var(--status-rejected-border)] dark:text-[var(--status-rejected-text)]">
                <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
                <p>
                  Red-flag timing is present but counsel has not been consulted. Consult employment counsel before finalizing.
                </p>
              </div>
            )}
            <p className="text-xs text-gray-500">
              On finalize: status → Fired, portal access disabled, client assignments removed, scheduling roster deactivated, §195(6) notice and internal memo generated, admins notified.
            </p>
          </div>
        )}

        <DialogFooter className="gap-2 sm:gap-0">
          {step !== 'Details' && (
            <Button
              type="button"
              variant="outline"
              disabled={loading}
              onClick={() => setStep(step === 'Compliance' ? 'Final pay' : 'Details')}
            >
              Back
            </Button>
          )}
          <Button type="button" variant="outline" onClick={() => handleClose(false)} disabled={loading}>
            Cancel
          </Button>
          {step === 'Details' && (
            <Button
              type="button"
              onClick={() => setStep('Final pay')}
              disabled={!canAdvanceDetails || !email?.trim()}
            >
              Next
            </Button>
          )}
          {step === 'Final pay' && (
            <Button type="button" onClick={() => setStep('Compliance')}>
              Next
            </Button>
          )}
          {step === 'Compliance' && (
            <Button
              type="button"
              variant="destructive"
              onClick={handleFinalize}
              disabled={loading || !canFinalize || !email?.trim()}
            >
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Finalize termination'}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
