'use client'

import { useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Loader2, Shield } from 'lucide-react'
import { useToast } from '@/components/ui/toast'

export default function ComplianceSettingsPage() {
  const { showToast } = useToast()
  const [running, setRunning] = useState(false)
  const [lastResult, setLastResult] = useState<{
    dryRun?: boolean
    scanned: number
    created?: number
    wouldCreate?: number
    acknowledgments?: { scanned: number; created?: number; wouldCreate?: number }
    fillablePdfs?: { scanned: number; created?: number; wouldCreate?: number }
  } | null>(null)

  const runAudit = async (dryRun: boolean) => {
    setRunning(true)
    setLastResult(null)
    try {
      const url = dryRun
        ? '/api/admin/onboarding/audit-existing-signatures?dryRun=true'
        : '/api/admin/onboarding/audit-existing-signatures'
      const res = await fetch(url, {
        method: 'POST',
        credentials: 'include',
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        showToast(data.error || 'Request failed', 'error')
        return
      }
      if (data.dryRun) {
        setLastResult({
          dryRun: true,
          scanned: data.scanned ?? 0,
          wouldCreate: data.wouldCreate ?? 0,
          acknowledgments: data.acknowledgments,
          fillablePdfs: data.fillablePdfs,
        })
        showToast(`Dry run: ${data.wouldCreate ?? 0} certificate(s) would be created (no changes saved).`, 'success')
      } else {
        setLastResult({
          dryRun: false,
          scanned: data.scanned ?? 0,
          created: data.created ?? 0,
          acknowledgments: data.acknowledgments,
          fillablePdfs: data.fillablePdfs,
        })
        showToast(`Created ${data.created ?? 0} compliance record(s).`, 'success')
      }
    } catch {
      showToast('Request failed', 'error')
    } finally {
      setRunning(false)
    }
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6 p-4 md:p-6">
      <div className="flex items-center gap-3">
        <Shield className="w-8 h-8 text-orange-600" />
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-[var(--text-primary)]">Compliance</h1>
          <p className="text-sm text-gray-600 dark:text-[var(--text-tertiary)]">
            E-SIGN / electronic signature records
          </p>
        </div>
      </div>

      <Card className="dark:bg-[var(--bg-elevated)] dark:border-[var(--border-subtle)]">
        <CardHeader>
          <CardTitle className="text-lg">Retroactive signature certificates</CardTitle>
          <CardDescription>
            One-time utility: create signature certificate rows for completed acknowledgment and fillable-PDF onboarding
            documents that are missing a certificate (e.g. finished before this feature). Safe to run multiple times —
            completions that already have a certificate are skipped.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-col sm:flex-row gap-3 flex-wrap">
            <Button
              type="button"
              variant="outline"
              onClick={() => void runAudit(true)}
              disabled={running}
              className="border-orange-300 text-orange-800 dark:border-orange-700 dark:text-orange-200"
            >
              {running ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
              Preview count (dry run)
            </Button>
            <Button
              type="button"
              onClick={() => void runAudit(false)}
              disabled={running}
              className="bg-[#e36f1e] hover:bg-[#c85e18] text-white"
            >
              {running ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
              Generate compliance records
            </Button>
          </div>
          <p className="text-xs text-gray-500 dark:text-[var(--text-tertiary)]">
            Dry run counts completed acknowledgments and fillable PDFs missing a certificate — nothing is written to the
            database.
          </p>
          {lastResult ? (
            <div className="text-sm text-gray-600 dark:text-[var(--text-secondary)] space-y-2">
              <p>
                {lastResult.dryRun ? (
                  <>
                    Dry run: <strong>{lastResult.wouldCreate ?? 0}</strong> certificate(s) would be created from{' '}
                    <strong>{lastResult.scanned}</strong> completion(s) scanned. No rows were inserted.
                  </>
                ) : (
                  <>
                    Scanned <strong>{lastResult.scanned}</strong> completion(s); created{' '}
                    <strong>{lastResult.created ?? 0}</strong> new certificate(s).
                  </>
                )}
              </p>
              {lastResult.acknowledgments ? (
                <p className="text-xs text-gray-500 dark:text-[var(--text-tertiary)]">
                  Acknowledgments:{' '}
                  {lastResult.dryRun ? (
                    <>
                      {lastResult.acknowledgments.wouldCreate ?? 0} would be created (of {lastResult.acknowledgments.scanned}{' '}
                      scanned)
                    </>
                  ) : (
                    <>
                      {lastResult.acknowledgments.created ?? 0} created (of {lastResult.acknowledgments.scanned} scanned)
                    </>
                  )}
                </p>
              ) : null}
              {lastResult.fillablePdfs ? (
                <p className="text-xs text-gray-500 dark:text-[var(--text-tertiary)]">
                  Fillable PDFs:{' '}
                  {lastResult.dryRun ? (
                    <>
                      {lastResult.fillablePdfs.wouldCreate ?? 0} would be created (of {lastResult.fillablePdfs.scanned}{' '}
                      scanned)
                    </>
                  ) : (
                    <>
                      {lastResult.fillablePdfs.created ?? 0} created (of {lastResult.fillablePdfs.scanned} scanned)
                    </>
                  )}
                </p>
              ) : null}
            </div>
          ) : null}
        </CardContent>
      </Card>
    </div>
  )
}
