import '@/components/crm/assessment/assessment-print.css'

/** Standalone print document — parent ClientServicesLayout already skips AppShell. */
export default function AssessmentPrintLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return <div className="assessment-print-root">{children}</div>
}
