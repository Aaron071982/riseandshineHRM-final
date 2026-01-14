'use client'

import { useEffect, useState } from 'react'
import UserSettingsPage from '@/components/settings/UserSettingsPage'
import AdminLayout from '@/components/layout/AdminLayout'
import RBTLayout from '@/components/layout/RBTLayout'

export const dynamic = 'force-dynamic'
export const revalidate = 0

type Role = 'ADMIN' | 'RBT' | 'CANDIDATE'

export default function SettingsRoute() {
  const [role, setRole] = useState<Role | null>(null)

  useEffect(() => {
    const loadRole = async () => {
      const response = await fetch('/api/profile')
      if (!response.ok) return
      const data = await response.json()
      setRole(data.user?.role || null)
    }
    loadRole()
  }, [])

  if (!role) {
    return <UserSettingsPage />
  }

  if (role === 'ADMIN') {
    return (
      <AdminLayout>
        <UserSettingsPage />
      </AdminLayout>
    )
  }

  return (
    <RBTLayout>
      <UserSettingsPage />
    </RBTLayout>
  )
}
