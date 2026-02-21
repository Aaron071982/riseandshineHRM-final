import Link from 'next/link'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Users, GraduationCap, Calculator, Megaphone, Headphones, Code2, ArrowRight } from 'lucide-react'

const OPTIONS = [
  { href: '/admin/rbts/new', label: 'Add RBT', description: 'Register a new RBT or candidate', icon: Users },
  { href: '/admin/employees/new/bcba', label: 'Add BCBA', description: 'Add a BCBA to the team', icon: GraduationCap },
  { href: '/admin/employees/new/billing', label: 'Add Billing', description: 'Add a billing team member', icon: Calculator },
  { href: '/admin/employees/new/marketing', label: 'Add Marketing', description: 'Add a marketing team member', icon: Megaphone },
  { href: '/admin/employees/new/call-center', label: 'Add Call Center', description: 'Add a call center team member', icon: Headphones },
  { href: '/admin/employees/new/dev-team', label: 'Add Dev Team', description: 'Create a new dev team', icon: Code2 },
]

export default function AddEmployeeChooserPage() {
  return (
    <div className="space-y-6">
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-blue-500 via-blue-400 to-indigo-400 p-8 shadow-lg">
        <div className="absolute top-0 right-0 w-32 h-32 bg-white/20 rounded-full -mr-16 -mt-16 bubble-animation" />
        <div className="absolute bottom-0 left-0 w-24 h-24 bg-white/20 rounded-full -ml-12 -mb-12 bubble-animation-delayed" />
        <div className="relative">
          <h1 className="text-4xl font-bold text-white mb-2">Add Employee / Candidate</h1>
          <p className="text-blue-50 text-lg">Choose the type of employee or team to add</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {OPTIONS.map((opt) => {
          const Icon = opt.icon
          return (
            <Link key={opt.href} href={opt.href}>
              <Card className="h-full hover:shadow-md dark:bg-[var(--bg-elevated)] dark:border-[var(--border-subtle)] dark:hover:bg-[var(--bg-elevated-hover)] dark:hover:border-[var(--border-medium)] transition-all cursor-pointer">
                <CardContent className="p-6 flex flex-col items-start">
                  <div className="rounded-lg bg-blue-50 dark:bg-[var(--status-interview-bg)] p-3 mb-4">
                    <Icon className="h-8 w-8 text-blue-600 dark:text-[var(--status-interview-text)]" />
                  </div>
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-[var(--text-primary)] mb-1">{opt.label}</h3>
                  <p className="text-sm text-gray-600 dark:text-[var(--text-tertiary)] mb-4 flex-1">{opt.description}</p>
                  <Button size="sm" variant="outline" className="dark:border-[var(--border-subtle)] dark:text-[var(--text-secondary)] dark:hover:border-[var(--orange-primary)] dark:hover:text-[var(--orange-primary)]">
                    Continue <ArrowRight className="ml-1 h-4 w-4" />
                  </Button>
                </CardContent>
              </Card>
            </Link>
          )
        })}
      </div>
    </div>
  )
}
