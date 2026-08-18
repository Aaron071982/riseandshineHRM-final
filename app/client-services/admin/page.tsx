import {
  getClientServicesUser,
  isSuperAdmin,
} from '@/lib/crm/access'
import { bootstrapCrmSuperAdmins } from '@/lib/crm/bootstrapRoles'
import AdminManagementClient from '@/components/crm/AdminManagementClient'

export const dynamic = 'force-dynamic'

export default async function ClientServicesAdminPage() {
  await bootstrapCrmSuperAdmins()

  const user = await getClientServicesUser()
  if (!isSuperAdmin(user)) {
    return (
      <div className="mx-auto max-w-lg rounded-xl border border-[var(--urgent)] bg-[var(--urgent-bg)] px-5 py-8 text-center">
        <h1 className="font-display text-lg font-semibold text-[var(--urgent)]">
          403 — Super-admin only
        </h1>
        <p className="mt-2 text-sm text-ink">
          Admin Management requires a CRM SUPER_ADMIN role (or break-glass
          super-admin email allowlist). Ask an existing super-admin to grant
          access.
        </p>
      </div>
    )
  }

  return <AdminManagementClient />
}
