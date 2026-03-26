'use client'

import AuditLog from '@/components/admin/AuditLog'

interface RBTProfileAuditLogProps {
  rbtProfileId: string
  rbtName: string
}

export default function RBTProfileAuditLog({ rbtProfileId, rbtName }: RBTProfileAuditLogProps) {
  return <AuditLog rbtProfileId={rbtProfileId} rbtName={rbtName} />
}
