import Link from 'next/link'
import { Badge } from '@/components/ui/badge'
import type { OrgTrainingAssignedModule } from '@/lib/org-training/load'
import { ArrowRight, CheckCircle2, Circle, PlayCircle } from 'lucide-react'
import { cn } from '@/lib/utils'

export default function OrgTrainingModuleList({
  modules,
  basePath,
  title = 'Training',
  subtitle,
  emptyMessage,
  hideHeader = false,
}: {
  modules: OrgTrainingAssignedModule[]
  basePath: string
  title?: string
  subtitle?: string
  emptyMessage?: string
  hideHeader?: boolean
}) {
  const required = modules.filter((m) => m.required)
  const track = required.length > 0 ? required : modules
  const done = track.filter((m) => m.completed).length
  const total = track.length
  const pct = total > 0 ? Math.round((done / total) * 100) : 0
  const outstanding = modules.filter((m) => !m.completed)

  return (
    <div className={hideHeader ? 'space-y-4' : 'mx-auto max-w-3xl space-y-8'}>
      {!hideHeader ? (
        <div className="overflow-hidden border border-[#e36f1e]/25 bg-gradient-to-br from-[#fff4eb] via-white to-[#fff8f2] shadow-sm">
          <div className="border-b border-[#e36f1e]/15 bg-[#e36f1e] px-5 py-4 text-white">
            <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-white/80">
              Rise &amp; Shine
            </p>
            <h1 className="mt-1 text-2xl font-bold tracking-tight sm:text-3xl">{title}</h1>
            {subtitle ? (
              <p className="mt-2 max-w-xl text-sm text-white/90">{subtitle}</p>
            ) : null}
          </div>
          {total > 0 ? (
            <div className="space-y-3 px-5 py-4">
              <div className="flex flex-wrap items-end justify-between gap-2">
                <div>
                  <p className="text-sm font-semibold text-gray-900">Your progress</p>
                  <p className="text-xs text-gray-600">
                    {done} of {total} {required.length > 0 ? 'required ' : ''}
                    module{total === 1 ? '' : 's'} complete
                  </p>
                </div>
                <p className="text-2xl font-bold tabular-nums text-[#e36f1e]">{pct}%</p>
              </div>
              <div
                className="h-3 w-full overflow-hidden bg-[#f3e6da]"
                role="progressbar"
                aria-valuenow={pct}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-label="Training progress"
              >
                <div
                  className="h-full bg-gradient-to-r from-[#e36f1e] to-[#f5a623] transition-all duration-500"
                  style={{ width: `${pct}%` }}
                />
              </div>
              {outstanding.length > 0 ? (
                <p className="text-xs font-medium text-[#c45a1a]">
                  {outstanding.length} left to finish — tap a module below to start.
                </p>
              ) : (
                <p className="text-xs font-medium text-emerald-700">
                  You&apos;re all caught up. Great work!
                </p>
              )}
            </div>
          ) : null}
        </div>
      ) : total > 0 ? (
        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="font-semibold text-gray-800">
              Progress · {done}/{total}
            </span>
            <span className="font-bold tabular-nums text-[#e36f1e]">{pct}%</span>
          </div>
          <div className="h-2.5 w-full overflow-hidden bg-[#f3e6da]">
            <div
              className="h-full bg-[#e36f1e] transition-all"
              style={{ width: `${pct}%` }}
            />
          </div>
        </div>
      ) : null}

      {modules.length === 0 ? (
        <div className="border border-dashed border-[#e36f1e]/30 bg-white px-6 py-10 text-center text-sm text-gray-500">
          {emptyMessage ?? 'No training modules assigned to you right now.'}
        </div>
      ) : (
        <ul className="space-y-3">
          {modules.map((m) => (
            <li key={m.id}>
              <Link
                href={`${basePath}/${m.id}`}
                className={cn(
                  'group flex flex-col gap-3 border-2 bg-white p-4 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md sm:flex-row sm:items-center sm:justify-between',
                  m.completed
                    ? 'border-emerald-200 hover:border-emerald-400'
                    : 'border-[#e36f1e]/35 hover:border-[#e36f1e]'
                )}
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-start gap-3">
                    {m.completed ? (
                      <CheckCircle2 className="mt-0.5 h-6 w-6 shrink-0 text-emerald-600" />
                    ) : (
                      <PlayCircle className="mt-0.5 h-6 w-6 shrink-0 text-[#e36f1e]" />
                    )}
                    <div className="min-w-0">
                      <p className="text-base font-bold text-gray-900 group-hover:text-[#c45a1a]">
                        {m.title}
                      </p>
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {m.required ? (
                          <Badge className="rounded-none bg-[#e36f1e] hover:bg-[#e36f1e]">
                            Required
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="rounded-none">
                            Optional
                          </Badge>
                        )}
                        {m.completed ? (
                          <Badge className="rounded-none bg-emerald-600 hover:bg-emerald-600">
                            Complete
                          </Badge>
                        ) : (
                          <Badge
                            variant="outline"
                            className="rounded-none border-amber-400 text-amber-800"
                          >
                            Not finished
                          </Badge>
                        )}
                        {m.hasQuiz ? (
                          <Badge variant="outline" className="rounded-none">
                            Includes quiz
                          </Badge>
                        ) : null}
                      </div>
                    </div>
                  </div>
                </div>
                <span
                  className={cn(
                    'inline-flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-bold transition',
                    m.completed
                      ? 'bg-emerald-50 text-emerald-800 group-hover:bg-emerald-100'
                      : 'bg-[#e36f1e] text-white group-hover:bg-[#c45a1a]'
                  )}
                >
                  {m.completed ? (
                    <>
                      <Circle className="h-4 w-4" />
                      Review module
                    </>
                  ) : (
                    <>
                      Start &amp; complete
                      <ArrowRight className="h-4 w-4" />
                    </>
                  )}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
