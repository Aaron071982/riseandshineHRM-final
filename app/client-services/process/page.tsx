import { getClientServicesPageUser } from '@/lib/crm/access'
import { loadProcessMap } from '@/lib/crm/processMap'
import ProcessMapCanvas from '@/components/crm/process-map/ProcessMapCanvas'

export const dynamic = 'force-dynamic'

const LEGEND = [
  {
    label: 'Next step hand-off',
    swatch: 'h-0.5 w-6 bg-[var(--brand)]',
  },
  {
    label: 'Back to an earlier department',
    swatch:
      'h-0.5 w-6 bg-[repeating-linear-gradient(90deg,var(--faint)_0_6px,transparent_6px_12px)]',
  },
  {
    label: 'Leadership oversight',
    swatch:
      'h-0.5 w-6 bg-[repeating-linear-gradient(90deg,var(--line)_0_2px,transparent_2px_8px)]',
  },
]

export default async function ProcessMapPage() {
  const user = await getClientServicesPageUser()
  if (!user) return null
  const data = await loadProcessMap(user)

  return (
    <div className="space-y-4">
      <header className="space-y-2">
        <h1 className="font-display text-xl font-semibold text-ink">
          Process map
        </h1>
        <p className="max-w-3xl text-sm leading-relaxed text-quiet">
          How a client moves through Client Services: each department owns a set
          of stages, finishes its part, and hands the case to the next
          department. People come from live CRM roles and case counts are live —
          click a department to open its queue.
        </p>
        <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-[11px] text-quiet">
          {LEGEND.map((item) => (
            <span key={item.label} className="flex items-center gap-2">
              <span className={item.swatch} aria-hidden />
              {item.label}
            </span>
          ))}
          <span className="text-faint">
            {data.viewerFullAccess
              ? 'Counts cover every live case.'
              : 'Counts cover only the cases in your scope.'}{' '}
            No client names appear on this chart.
          </span>
        </div>
      </header>

      <ProcessMapCanvas data={data} />
    </div>
  )
}
