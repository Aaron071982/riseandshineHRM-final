'use client'

import { useState } from 'react'
import type { ScheduleTherapist, ScheduleClient } from '@/lib/schedule/types'
import {
  upsertTherapist,
  upsertClient,
  updateClientMeta,
  updateTherapistBorough,
  addAllowedUser,
  removeAllowedUser,
} from '@/lib/schedule/actions'
import { NYC_BOROUGHS } from '@/lib/schedule/export'
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
  const [newTherapist, setNewTherapist] = useState({ name: '', borough: '' })
  const [newClient, setNewClient] = useState({ name: '', code: '', borough: '' })
  const [newEmail, setNewEmail] = useState('')

  const addTherapist = async () => {
    if (!newTherapist.name.trim()) return
    try {
      await upsertTherapist({
        name: newTherapist.name.trim(),
        borough: newTherapist.borough.trim() || null,
      })
      setNewTherapist({ name: '', borough: '' })
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
        borough: newClient.borough.trim() || null,
      })
      setNewClient({ name: '', code: '', borough: '' })
      showToast('Client added', 'success')
      onRefresh()
    } catch {
      showToast('Failed to add client', 'error')
    }
  }

  const setClientBorough = async (id: string, borough: string) => {
    try {
      await updateClientMeta(id, { borough: borough || null })
      showToast('Borough saved', 'success')
      onRefresh()
    } catch {
      showToast('Failed to save borough', 'error')
    }
  }

  const setTherapistBorough = async (id: string, borough: string) => {
    try {
      await updateTherapistBorough(id, borough || null)
      showToast('RBT borough saved', 'success')
      onRefresh()
    } catch {
      showToast('Failed to save borough', 'error')
    }
  }

  const toggleActive = async (type: 'therapist' | 'client', id: string, active: boolean) => {
    try {
      if (type === 'therapist') {
        const t = therapists.find((x) => x.id === id)
        if (t)
          await upsertTherapist({
            id,
            name: t.name,
            borough: t.borough,
            active: !active,
          })
      } else {
        const c = clients.find((x) => x.id === id)
        if (c)
          await upsertClient({
            id,
            name: c.name,
            code: c.code,
            borough: c.borough,
            active: !active,
          })
      }
      onRefresh()
    } catch {
      showToast('Update failed', 'error')
    }
  }

  const grantAccess = async () => {
    if (!newEmail.trim()) return
    try {
      await addAllowedUser(newEmail.trim())
      setNewEmail('')
      showToast('Access granted', 'success')
      onRefresh()
    } catch {
      showToast('Failed to add access', 'error')
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
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
            <p className="text-xs text-gray-500">
              Export groups by client borough. Set each client&apos;s borough below (or during
              Artemis import) — remembered for future exports.
            </p>
            <div className="grid grid-cols-2 gap-2">
              <Input
                placeholder="New therapist name"
                value={newTherapist.name}
                onChange={(e) => setNewTherapist((p) => ({ ...p, name: e.target.value }))}
              />
              <select
                className="h-9 rounded-md border px-2 text-sm"
                value={newTherapist.borough}
                onChange={(e) => setNewTherapist((p) => ({ ...p, borough: e.target.value }))}
              >
                <option value="">Borough (optional)</option>
                {NYC_BOROUGHS.map((b) => (
                  <option key={b} value={b}>
                    {b}
                  </option>
                ))}
              </select>
            </div>
            <Button onClick={addTherapist} className="bg-[#0E4D52]">
              Add
            </Button>
            <ul className="text-sm space-y-2 max-h-64 overflow-y-auto">
              {therapists.map((t) => (
                <li
                  key={t.id}
                  className="flex flex-wrap justify-between items-center gap-2 py-1.5 border-b"
                >
                  <span className={!t.active ? 'line-through text-gray-400 min-w-0' : 'min-w-0'}>
                    {t.name} <span className="text-xs text-gray-400">{t.role}</span>
                  </span>
                  <div className="flex items-center gap-1 shrink-0">
                    <select
                      className="h-8 rounded-md border px-1.5 text-xs max-w-[8.5rem]"
                      value={t.borough ?? ''}
                      disabled={!t.active}
                      onChange={(e) => void setTherapistBorough(t.id, e.target.value)}
                    >
                      <option value="">No borough</option>
                      {NYC_BOROUGHS.map((b) => (
                        <option key={b} value={b}>
                          {b}
                        </option>
                      ))}
                    </select>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => toggleActive('therapist', t.id, t.active)}
                    >
                      {t.active ? 'Deactivate' : 'Activate'}
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          </TabsContent>

          <TabsContent value="clients" className="space-y-3 mt-3">
            <p className="text-xs text-gray-500">
              Set each client&apos;s borough so Export groups by borough → client.
            </p>
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
              <select
                className="col-span-2 h-9 rounded-md border px-2 text-sm"
                value={newClient.borough}
                onChange={(e) => setNewClient((p) => ({ ...p, borough: e.target.value }))}
              >
                <option value="">Borough (optional)</option>
                {NYC_BOROUGHS.map((b) => (
                  <option key={b} value={b}>
                    {b}
                  </option>
                ))}
              </select>
            </div>
            <Button onClick={addClient} className="bg-[#0E4D52]">
              Add client
            </Button>
            <ul className="text-sm space-y-2 max-h-64 overflow-y-auto">
              {clients.map((c) => (
                <li
                  key={c.id}
                  className="flex flex-wrap justify-between items-center gap-2 py-1.5 border-b"
                >
                  <span className={!c.active ? 'line-through text-gray-400 min-w-0' : 'min-w-0'}>
                    {c.name} {c.code && <span className="text-xs text-gray-400">{c.code}</span>}
                  </span>
                  <div className="flex items-center gap-1 shrink-0">
                    <Label className="sr-only">Borough</Label>
                    <select
                      className="h-8 rounded-md border px-1.5 text-xs max-w-[8.5rem]"
                      value={c.borough ?? ''}
                      disabled={!c.active}
                      onChange={(e) => void setClientBorough(c.id, e.target.value)}
                    >
                      <option value="">No borough</option>
                      {NYC_BOROUGHS.map((b) => (
                        <option key={b} value={b}>
                          {b}
                        </option>
                      ))}
                    </select>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => toggleActive('client', c.id, c.active)}
                    >
                      {c.active ? 'Deactivate' : 'Activate'}
                    </Button>
                  </div>
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
