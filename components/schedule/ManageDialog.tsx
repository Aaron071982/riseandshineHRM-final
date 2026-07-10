'use client'

import { useState } from 'react'
import type { ScheduleTherapist, ScheduleClient } from '@/lib/schedule/types'
import {
  upsertTherapist,
  upsertClient,
  addAllowedUser,
  removeAllowedUser,
} from '@/lib/schedule/actions'
import { useToast } from '@/components/ui/toast'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'

export default function ManageDialog({
  open,
  onClose,
  therapists,
  clients,
  allowedUsers,
  onRefresh,
}: {
  open: boolean
  onClose: () => void
  therapists: ScheduleTherapist[]
  clients: ScheduleClient[]
  allowedUsers: { id: string; email: string }[]
  onRefresh: () => void
}) {
  const { showToast } = useToast()
  const [newTherapist, setNewTherapist] = useState('')
  const [newClient, setNewClient] = useState({ name: '', code: '' })
  const [newEmail, setNewEmail] = useState('')

  const addTherapist = async () => {
    if (!newTherapist.trim()) return
    try {
      await upsertTherapist({ name: newTherapist.trim() })
      setNewTherapist('')
      showToast('Therapist added', 'success')
      onRefresh()
    } catch {
      showToast('Failed to add therapist', 'error')
    }
  }

  const addClient = async () => {
    if (!newClient.name.trim()) return
    try {
      await upsertClient({
        name: newClient.name.trim(),
        code: newClient.code.trim() || null,
      })
      setNewClient({ name: '', code: '' })
      showToast('Client added', 'success')
      onRefresh()
    } catch {
      showToast('Failed to add client', 'error')
    }
  }

  const toggleActive = async (type: 'therapist' | 'client', id: string, active: boolean) => {
    try {
      if (type === 'therapist') {
        const t = therapists.find((x) => x.id === id)
        if (t) await upsertTherapist({ id, name: t.name, active: !active })
      } else {
        const c = clients.find((x) => x.id === id)
        if (c) await upsertClient({ id, name: c.name, code: c.code, active: !active })
      }
      onRefresh()
    } catch {
      showToast('Update failed', 'error')
    }
  }

  const grantAccess = async () => {
    if (!newEmail.includes('@')) return
    try {
      await addAllowedUser(newEmail)
      setNewEmail('')
      showToast('Access granted', 'success')
      onRefresh()
    } catch {
      showToast('Failed to add email', 'error')
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Manage schedule</DialogTitle>
        </DialogHeader>
        <Tabs defaultValue="therapists">
          <TabsList>
            <TabsTrigger value="therapists">Therapists</TabsTrigger>
            <TabsTrigger value="clients">Clients</TabsTrigger>
            <TabsTrigger value="access">Access</TabsTrigger>
          </TabsList>

          <TabsContent value="therapists" className="space-y-3 mt-3">
            <div className="flex gap-2">
              <Input
                placeholder="New therapist name"
                value={newTherapist}
                onChange={(e) => setNewTherapist(e.target.value)}
              />
              <Button onClick={addTherapist} className="bg-[#0E4D52] shrink-0">
                Add
              </Button>
            </div>
            <ul className="text-sm space-y-1 max-h-48 overflow-y-auto">
              {therapists.map((t) => (
                <li key={t.id} className="flex justify-between items-center py-1 border-b">
                  <span className={!t.active ? 'line-through text-gray-400' : ''}>
                    {t.name} <span className="text-xs text-gray-400">{t.role}</span>
                  </span>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => toggleActive('therapist', t.id, t.active)}
                  >
                    {t.active ? 'Deactivate' : 'Activate'}
                  </Button>
                </li>
              ))}
            </ul>
          </TabsContent>

          <TabsContent value="clients" className="space-y-3 mt-3">
            <div className="grid grid-cols-2 gap-2">
              <Input
                placeholder="Client name"
                value={newClient.name}
                onChange={(e) => setNewClient((p) => ({ ...p, name: e.target.value }))}
              />
              <Input
                placeholder="Code (A-30)"
                value={newClient.code}
                onChange={(e) => setNewClient((p) => ({ ...p, code: e.target.value }))}
              />
            </div>
            <Button onClick={addClient} className="bg-[#0E4D52]">
              Add client
            </Button>
            <ul className="text-sm space-y-1 max-h-48 overflow-y-auto">
              {clients.map((c) => (
                <li key={c.id} className="flex justify-between items-center py-1 border-b">
                  <span className={!c.active ? 'line-through text-gray-400' : ''}>
                    {c.name} {c.code && <span className="text-xs text-gray-400">{c.code}</span>}
                  </span>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => toggleActive('client', c.id, c.active)}
                  >
                    {c.active ? 'Deactivate' : 'Activate'}
                  </Button>
                </li>
              ))}
            </ul>
          </TabsContent>

          <TabsContent value="access" className="space-y-3 mt-3">
            <p className="text-xs text-gray-500">
              Controls who can open /schedule. Changes take effect immediately.
            </p>
            <div className="flex gap-2">
              <Input
                type="email"
                placeholder="email@domain.com"
                value={newEmail}
                onChange={(e) => setNewEmail(e.target.value)}
              />
              <Button onClick={grantAccess} className="bg-[#0E4D52] shrink-0">
                Add
              </Button>
            </div>
            <ul className="text-sm space-y-1">
              {allowedUsers.map((u) => (
                <li key={u.id} className="flex justify-between py-1 border-b items-center gap-2">
                  <span>{u.email}</span>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="text-red-600"
                    onClick={async () => {
                      try {
                        await removeAllowedUser(u.id)
                        showToast('Access removed', 'success')
                        onRefresh()
                      } catch {
                        showToast('Failed to remove', 'error')
                      }
                    }}
                  >
                    Remove
                  </Button>
                </li>
              ))}
            </ul>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  )
}
