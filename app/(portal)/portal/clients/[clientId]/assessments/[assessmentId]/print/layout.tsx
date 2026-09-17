import '@/components/crm/assessment/assessment-print.css'

/** Standalone print document — PortalShell already skips chrome on /print. */
export default function PortalAssessmentPrintLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return <div className="assessment-print-root">{children}</div>
}
