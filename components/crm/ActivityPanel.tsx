import { STAGE_LABELS } from '@/lib/crm/stages'
import type { ClientStage } from '@prisma/client'

type Hist = {
  id: string
  fromStatus: string | null
  toStatus: string | null
  fromStage: ClientStage | null
  toStage: ClientStage | null
  durationSeconds: number | null
  reason: string | null
  createdAt: string | Date
  changedByUser: { id: string; name: string | null; email: string | null } | null
}

type AccessLog = {
  id: string
  action: string
  createdAt: string | Date
  user: { id: string; name: string | null; email: string | null }
}

function formatDuration(seconds: number | null): string | null {
  if (seconds == null) return null
  if (seconds < 3600) return `${Math.round(seconds / 60)} min in prior stage`
  if (seconds < 86400) return `${Math.round(seconds / 3600)} hr in prior stage`
  return `${Math.round(seconds / 86400)} days in prior stage`
}

export function ActivityPanel({
  history,
  accessLogs,
}: {
  history: Hist[]
  accessLogs: AccessLog[]
}) {
  type Item =
    | { kind: 'stage'; at: number; row: Hist }
    | { kind: 'access'; at: number; row: AccessLog }

  const items: Item[] = [
    ...history.map((row) => ({
      kind: 'stage' as const,
      at: new Date(row.createdAt).getTime(),
      row,
    })),
    ...accessLogs.map((row) => ({
      kind: 'access' as const,
      at: new Date(row.createdAt).getTime(),
      row,
    })),
  ].sort((a, b) => b.at - a.at)

  if (items.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-line px-4 py-10 text-center">
        <p className="font-display text-base font-semibold text-ink">No activity yet</p>
        <p className="mt-1 text-sm text-quiet">
          Stage changes and access events for this client will show up here.
        </p>
      </div>
    )
  }

  return (
    <ol className="space-y-3">
      {items.map((item) => {
        if (item.kind === 'stage') {
          const h = item.row
          const from = h.fromStage ? STAGE_LABELS[h.fromStage] : h.fromStatus
          const to = h.toStage ? STAGE_LABELS[h.toStage] : h.toStatus
          const who =
            h.changedByUser?.name || h.changedByUser?.email || 'System'
          const dur = formatDuration(h.durationSeconds)
          return (
            <li
              key={`h-${h.id}`}
              className="rounded-xl border border-line bg-surface px-4 py-3"
            >
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <p className="text-sm font-medium text-ink">
                  {from && to ? (
                    <>
                      {from} <span className="text-faint">→</span> {to}
                    </>
                  ) : (
                    to || 'Status update'
                  )}
                </p>
                <time className="text-xs tabular-nums text-quiet">
                  {new Date(h.createdAt).toLocaleString()}
                </time>
              </div>
              <p className="mt-1 text-xs text-quiet">
                {who}
                {h.reason ? ` · ${h.reason}` : ''}
                {dur ? ` · ${dur}` : ''}
              </p>
            </li>
          )
        }

        const a = item.row
        return (
          <li
            key={`a-${a.id}`}
            className="rounded-xl border border-line bg-line-2/60 px-4 py-2.5"
          >
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <p className="text-sm text-ink">
                <span className="font-medium">{a.action}</span>
                <span className="text-quiet">
                  {' '}
                  · {a.user.name || a.user.email || 'User'}
                </span>
              </p>
              <time className="text-xs tabular-nums text-quiet">
                {new Date(a.createdAt).toLocaleString()}
              </time>
            </div>
          </li>
        )
      })}
    </ol>
  )
}

export function Phase3Stub({ title }: { title: string }) {
  return (
    <div className="rounded-xl border border-dashed border-line bg-surface px-4 py-12 text-center">
      <p className="font-display text-base font-semibold text-ink">{title}</p>
      <p className="mt-1 text-sm text-quiet">Coming in Phase 3.</p>
    </div>
  )
}
