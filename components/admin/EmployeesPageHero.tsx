'use client'

import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { useEffect, useRef } from 'react'
import { Plus, LayoutList, LayoutGrid } from 'lucide-react'
import { Button } from '@/components/ui/button'
import type { EmployeeListType } from '@/app/admin/employees/page'

const RBT_VIEW_KEY = 'rbt-view'

interface EmployeesPageHeroProps {
  currentType: EmployeeListType
}

export default function EmployeesPageHero({ currentType }: EmployeesPageHeroProps) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const hasSyncedRef = useRef(false)

  useEffect(() => {
    if (hasSyncedRef.current) return
    const viewParam = searchParams.get('view')
    if (viewParam === 'list' || viewParam === 'board') return
    const stored = typeof window !== 'undefined' ? localStorage.getItem(RBT_VIEW_KEY) : null
    const view = stored === 'board' ? 'board' : 'list'
    hasSyncedRef.current = true
    const params = new URLSearchParams(searchParams.toString())
    params.set('view', view)
    router.replace(`/admin/employees?${params.toString()}`)
  }, [router, searchParams])

  const handleViewChange = (view: 'list' | 'board') => {
    const params = new URLSearchParams(searchParams.toString())
    params.set('type', currentType)
    params.set('view', view)
    if (typeof window !== 'undefined') localStorage.setItem(RBT_VIEW_KEY, view)
    router.push(`/admin/employees?${params.toString()}`)
  }

  const view = searchParams.get('view') === 'board' ? 'board' : 'list'

  return (
    <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-blue-500 via-blue-400 to-indigo-400 p-8 shadow-lg">
      <div className="absolute top-0 right-0 w-32 h-32 bg-white/20 rounded-full -mr-16 -mt-16 bubble-animation" />
      <div className="absolute bottom-0 left-0 w-24 h-24 bg-white/20 rounded-full -ml-12 -mb-12 bubble-animation-delayed" />
      <div className="relative flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-4xl font-bold text-white mb-2">Employees and Candidates</h1>
          <p className="text-blue-50 text-lg">Manage your hiring pipeline and all employees</p>
        </div>
        <div className="flex items-center gap-2">
          {currentType === 'RBT' && (
            <div className="flex rounded-lg border border-white/30 bg-white/10 p-1">
              <button
                type="button"
                onClick={() => handleViewChange('list')}
                className={`rounded-md p-2 transition-colors ${view === 'list' ? 'bg-white text-blue-700' : 'text-white hover:bg-white/20'}`}
                title="List view"
                aria-pressed={view === 'list'}
              >
                <LayoutList className="h-5 w-5" />
              </button>
              <button
                type="button"
                onClick={() => handleViewChange('board')}
                className={`rounded-md p-2 transition-colors ${view === 'board' ? 'bg-white text-blue-700' : 'text-white hover:bg-white/20'}`}
                title="Board view"
                aria-pressed={view === 'board'}
              >
                <LayoutGrid className="h-5 w-5" />
              </button>
            </div>
          )}
          <Link href="/admin/employees/new">
            <Button className="rounded-xl px-6 py-6 text-base font-semibold bg-white/90 text-blue-700 hover:bg-white border-0 shadow-md">
              <Plus className="w-4 h-4 mr-2" />
              Add Employee / Candidate
            </Button>
          </Link>
        </div>
      </div>
    </div>
  )
}
