'use client'

import { useEffect, useState, useTransition } from 'react'
import {
  listDeletedServiceClients,
  restoreServiceClient,
} from '@/lib/crm/actions'
import { ConfirmDestructiveDialog } from '@/components/crm/ConfirmDestructiveDialog'

export default function DeletedFamiliesPanel() {
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState('')
  const [rows, setRows] = useState<
    {
      id: string
      clientCode: string
      firstName: string
      lastName: string
      deletedAt: string
    }[]
  >([])
  const [restoreId, setRestoreId] = useState<string | null>(null)

  const load = () => {
    startTransition(async () => {
      const res = await listDeletedServiceClients()
      if (!res.ok) {
        setError(res.error)
        return
      }
      setError('')
      setRows(res.clients)
    })
  }

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const target = rows.find((r) => r.id === restoreId)
  const label = target
    ? `${target.firstName} ${target.lastName} (${target.clientCode})`
    : ''

  return (
    <section className="rounded-xl border border-line bg-surface p-4">
      <h2 className="font-display text-lg font-semibold text-ink">
        Deleted family records
      </h2>
      <p className="mt-0.5 text-sm text-quiet">
        Soft-deleted rows stay in the database. Restore is full-access only and
        is audited.
      </p>
      {error && (
        <p className="mt-2 text-sm text-[var(--urgent)]">{error}</p>
      )}
      {rows.length === 0 && !pending ? (
        <p className="mt-3 text-sm text-quiet">No deleted family records.</p>
      ) : (
        <ul className="mt-3 divide-y divide-line">
          {rows.map((r) => (
            <li
              key={r.id}
              className="flex flex-wrap items-center justify-between gap-2 py-2"
            >
              <div>
                <div className="text-sm font-medium text-ink">
                  {r.firstName} {r.lastName}{' '}
                  <span className="font-mono text-xs text-quiet">
                    {r.clientCode}
                  </span>
                </div>
                <div className="text-xs text-quiet">
                  Deleted {new Date(r.deletedAt).toLocaleString()}
                </div>
              </div>
              <button
                type="button"
                className="text-xs font-medium text-brand hover:underline"
                onClick={() => setRestoreId(r.id)}
              >
                Restore
              </button>
            </li>
          ))}
        </ul>
      )}
      <ConfirmDestructiveDialog
        open={!!restoreId}
        onOpenChange={(o) => {
          if (!o) setRestoreId(null)
        }}
        title="Restore family record"
        description={`Restore ${label} to the live caseload? This writes an audit log and the family will appear in queues again.`}
        confirmLabel="Restore"
        pending={pending}
        onConfirm={async () => {
          if (!restoreId) return
          startTransition(async () => {
            const res = await restoreServiceClient(restoreId)
            if (!res.ok) {
              setError(res.error)
              return
            }
            setRestoreId(null)
            load()
          })
        }}
      />
    </section>
  )
}
