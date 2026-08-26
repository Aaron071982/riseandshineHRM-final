import Link from 'next/link'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import type { OrgTrainingAssignedModule } from '@/lib/org-training/load'
import { CheckCircle2, Circle } from 'lucide-react'

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
  const doneRequired = required.filter((m) => m.completed).length

  return (
    <div className={hideHeader ? 'space-y-3' : 'mx-auto max-w-3xl space-y-6'}>
      {!hideHeader ? (
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-[var(--text-primary)]">
            {title}
          </h1>
          {subtitle ? (
            <p className="mt-1 text-sm text-gray-600 dark:text-[var(--text-secondary)]">
              {subtitle}
            </p>
          ) : null}
          {required.length > 0 ? (
            <p className="mt-2 text-sm font-medium text-gray-700 dark:text-[var(--text-secondary)]">
              Required: {doneRequired}/{required.length} complete
            </p>
          ) : null}
        </div>
      ) : required.length > 0 ? (
        <p className="text-sm font-medium text-gray-700 dark:text-[var(--text-secondary)]">
          Required: {doneRequired}/{required.length} complete
        </p>
      ) : null}

      {modules.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center text-sm text-gray-500">
            {emptyMessage ?? 'No training modules assigned to you right now.'}
          </CardContent>
        </Card>
      ) : (
        <ul className="space-y-3">
          {modules.map((m) => (
            <li key={m.id}>
              <Link href={`${basePath}/${m.id}`}>
                <Card className="transition-colors hover:border-[#e36f1e]/40">
                  <CardHeader className="flex flex-row items-start justify-between gap-3 space-y-0 pb-2">
                    <CardTitle className="text-base">{m.title}</CardTitle>
                    {m.completed ? (
                      <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-600" />
                    ) : (
                      <Circle className="h-5 w-5 shrink-0 text-gray-300" />
                    )}
                  </CardHeader>
                  <CardContent className="flex flex-wrap gap-2">
                    {m.required ? (
                      <Badge variant="secondary">Required</Badge>
                    ) : (
                      <Badge variant="outline">Optional</Badge>
                    )}
                    {m.completed ? (
                      <Badge className="bg-emerald-600 hover:bg-emerald-600">
                        Complete
                      </Badge>
                    ) : (
                      <Badge variant="outline">Outstanding</Badge>
                    )}
                    {m.hasQuiz ? <Badge variant="outline">Quiz</Badge> : null}
                  </CardContent>
                </Card>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
