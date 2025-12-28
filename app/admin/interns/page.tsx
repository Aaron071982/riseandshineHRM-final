// DEV ONLY — NOT FOR PRODUCTION — NO DB
// Main interns page with tabs for candidates and interns

'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
// Using a simple button-based tab switcher since tabs component doesn't exist
import Link from 'next/link'
import { Plus, Users } from 'lucide-react'
import InternCandidateList from '@/components/admin/InternCandidateList'
import type { InternCandidate, Intern } from '@/lib/intern-storage'

export default function InternsPage() {
  const [candidates, setCandidates] = useState<InternCandidate[]>([])
  const [interns, setInterns] = useState<Intern[]>([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<'candidates' | 'interns'>('candidates')

  useEffect(() => {
    fetchData()
  }, [])

  const fetchData = async () => {
    try {
      const [candidatesRes, internsRes] = await Promise.all([
        fetch('/api/dev/intern-candidates'),
        fetch('/api/dev/interns'),
      ])
      const candidatesData = await candidatesRes.json()
      const internsData = await internsRes.json()
      setCandidates(candidatesData)
      setInterns(internsData)
    } catch (error) {
      console.error('Error fetching data:', error)
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return <div>Loading...</div>
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 pb-6 border-b">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Interns</h1>
          <p className="text-gray-600 mt-1">Manage intern candidates and active interns</p>
        </div>
        <Link href="/admin/interns/candidates/new">
          <Button>
            <Plus className="w-4 h-4 mr-2" />
            Add New Candidate
          </Button>
        </Link>
      </div>

      <div className="space-y-4">
        <div className="flex gap-2 border-b">
          <button
            onClick={() => setActiveTab('candidates')}
            className={`px-4 py-2 font-medium border-b-2 transition-colors ${
              activeTab === 'candidates'
                ? 'border-orange-500 text-orange-600'
                : 'border-transparent text-gray-600 hover:text-gray-900'
            }`}
          >
            Intern Candidates ({candidates.length})
          </button>
          <button
            onClick={() => setActiveTab('interns')}
            className={`px-4 py-2 font-medium border-b-2 transition-colors ${
              activeTab === 'interns'
                ? 'border-orange-500 text-orange-600'
                : 'border-transparent text-gray-600 hover:text-gray-900'
            }`}
          >
            Interns ({interns.length})
          </button>
        </div>

        {activeTab === 'candidates' && (
          <InternCandidateList initialCandidates={candidates} />
        )}

        {activeTab === 'interns' && (
          <InternList initialInterns={interns} />
        )}
      </div>
    </div>
  )
}

function InternList({ initialInterns }: { initialInterns: Intern[] }) {
  if (initialInterns.length === 0) {
    return (
      <Card>
        <CardContent className="p-12 text-center">
          <Users className="w-12 h-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-gray-900 mb-2">No interns yet</h3>
          <p className="text-gray-600">
            Hire a candidate to create an intern record
          </p>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="grid gap-4">
      {initialInterns.map((intern) => (
        <Link key={intern.id} href={`/admin/interns/${intern.id}`}>
          <Card className="hover:shadow-md transition-shadow cursor-pointer">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <h3 className="text-lg font-semibold text-gray-900">
                      {intern.name}
                    </h3>
                    <span className={`px-2 py-1 rounded text-sm font-medium ${
                      intern.status === 'Active' 
                        ? 'bg-green-100 text-green-700' 
                        : 'bg-gray-100 text-gray-700'
                    }`}>
                      {intern.status}
                    </span>
                  </div>
                  <div className="space-y-1 text-sm text-gray-600">
                    <p><span className="font-medium">Email:</span> {intern.email}</p>
                    {intern.phone && (
                      <p><span className="font-medium">Phone:</span> {intern.phone}</p>
                    )}
                    <p><span className="font-medium">Role:</span> {intern.role}</p>
                    {intern.expectedHoursPerWeek && (
                      <p><span className="font-medium">Hours/Week:</span> {intern.expectedHoursPerWeek}</p>
                    )}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </Link>
      ))}
    </div>
  )
}

