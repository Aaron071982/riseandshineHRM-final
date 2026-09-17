import {
  getClientServicesPageUser,
  isSuperAdmin,
} from '@/lib/crm/access'
import { bootstrapCrmSuperAdmins } from '@/lib/crm/bootstrapRoles'
import AdminManagementClient from '@/components/crm/AdminManagementClient'
import DeletedFamiliesPanel from '@/components/crm/DeletedFamiliesPanel'
import BoardMigrationReviewPanel from '@/components/crm/BoardMigrationReviewPanel'
import KioskDevicesPanel from '@/components/crm/KioskDevicesPanel'

export const dynamic = 'force-dynamic'

export default async function ClientServicesAdminPage() {
  await bootstrapCrmSuperAdmins()

  const user = await getClientServicesPageUser()
  if (!user) return null
  if (!isSuperAdmin(user)) {
    return (
      <div className="mx-auto max-w-lg rounded-xl border border-[var(--urgent)] bg-[var(--urgent-bg)] px-5 py-8 text-center">
        <h1 className="font-display text-lg font-semibold text-[var(--urgent)]">
          403 — Super-admin only
        </h1>
        <p className="mt-2 text-sm text-ink">
          Roles &amp; privileges requires CRM SUPER_ADMIN (or a break-glass
          super-admin email). Ask an existing super-admin to grant you access.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-8">
      <AdminManagementClient />
      <BoardMigrationReviewPanel />
      <KioskDevicesPanel />
      <DeletedFamiliesPanel />
    </div>
  )
}
