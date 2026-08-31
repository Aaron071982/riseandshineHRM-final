import '@/components/crm/caseCoordination/case-coordination-print.css'

export default function CaseCoordinationPrintLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return <div className="case-coord-print-root">{children}</div>
}
