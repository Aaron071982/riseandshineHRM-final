import '@/components/crm/assessment/assessment-print.css'

export default function AssessmentPrintLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return <div className="assessment-print-root">{children}</div>
}
