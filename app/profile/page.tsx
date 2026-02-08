'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import ProfilePage from '@/components/profile/ProfilePage'
import AdminLayout from '@/components/layout/AdminLayout'
import RBTLayout from '@/components/layout/RBTLayout'

export const dynamic = 'force-dynamic'
export const revalidate = 0

type Role = 'ADMIN' | 'RBT' | 'CANDIDATE'

export default function ProfileRoute() {
  const router = useRouter()
  const [role, setRole] = useState<Role | null>(null)

  useEffect(() => {
    const loadRole = async () => {
      const response = await fetch('/api/profile', { credentials: 'include' })
      if (response.status === 401) {
        router.replace('/login?session_expired=1')
        return
      }
      if (!response.ok) return
      const data = await response.json()
      setRole(data.user?.role || null)
    }
    loadRole()
  }, [router])

  if (!role) {
    return <ProfilePage />
  }

  if (role === 'ADMIN') {
    return (
      <AdminLayout>
        <ProfilePage />
      </AdminLayout>
    )
  }

  return (
    <RBTLayout>
      <ProfilePage />
    </RBTLayout>
  )
}
