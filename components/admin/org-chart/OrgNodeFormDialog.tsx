'use client'

import { useEffect, useMemo, useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Loader2 } from 'lucide-react'
import {
  ORG_DEPARTMENTS,
  SUB_DEPARTMENTS_BY_DEPARTMENT,
  defaultAvatarColorForDepartment,
  normalizeDepartmentForDisplay,
  type OrgDepartment,
} from '@/lib/org-chart-departments'
import type { OrgNodeDTO } from './types'

type UserOption = {
  id: string
  name: string | null
  email: string | null
  role: string
  rbtProfile: { id: string } | null
}

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  mode: 'create' | 'edit'
  initialParentId: string | null
  editNode: OrgNodeDTO | null
  flatNodes: OrgNodeDTO[]
  onSaved: () => void
}

export default function OrgNodeFormDialog({
  open,
  onOpenChange,
  mode,
  initialParentId,
  editNode,
  flatNodes,
  onSaved,
}: Props) {
  const [loading, setLoading] = useState(false)
  const [users, setUsers] = useState<UserOption[]>([])
  const [name, setName] = useState('')
  const [title, setTitle] = useState('')
  const [department, setDepartment] = useState<string>(ORG_DEPARTMENTS[0])
  const [subDepartment, setSubDepartment] = useState<string>('__none__')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [parentId, setParentId] = useState<string | null>(null)
  const [linkedUserId, setLinkedUserId] = useState<string>('__none__')
  const [avatarColor, setAvatarColor] = useState('#f97316')
  const [parentQuery, setParentQuery] = useState('')

  useEffect(() => {
    if (!open) return
    fetch('/api/admin/org-chart/users', { credentials: 'include' })
      .then((r) => (r.ok ? r.json() : { users: [] }))
      .then((d) => setUsers(Array.isArray(d.users) ? d.users : []))
      .catch(() => setUsers([]))
  }, [open])

  useEffect(() => {
    if (!open) return
    if (mode === 'edit' && editNode) {
      setName(editNode.name)
      setTitle(editNode.title)
      const deptNorm = normalizeDepartmentForDisplay(editNode.department) || editNode.department || ORG_DEPARTMENTS[0]
      setDepartment(deptNorm)
      setSubDepartment(editNode.subDepartment?.trim() ? editNode.subDepartment! : '__none__')
      setEmail(editNode.email || '')
      setPhone(editNode.phone || '')
      setParentId(editNode.parentId)
      setLinkedUserId(editNode.linkedUserId || '__none__')
      setAvatarColor(editNode.avatarColor || defaultAvatarColorForDepartment(deptNorm))
    } else {
      setName('')
      setTitle('')
      setDepartment(ORG_DEPARTMENTS[0])
      setSubDepartment('__none__')
      setEmail('')
      setPhone('')
      setParentId(initialParentId)
      setLinkedUserId('__none__')
      setAvatarColor(defaultAvatarColorForDepartment(ORG_DEPARTMENTS[0]))
    }
    setParentQuery('')
  }, [open, mode, editNode, initialParentId])

  const parentChoices = useMemo(() => {
    const q = parentQuery.trim().toLowerCase()
    return flatNodes.filter((n) => {
      if (mode === 'edit' && editNode && n.id === editNode.id) return false
      if (!q) return true
      return n.name.toLowerCase().includes(q) || n.title.toLowerCase().includes(q)
    })
  }, [flatNodes, parentQuery, mode, editNode])

  const subOptionsForDept = SUB_DEPARTMENTS_BY_DEPARTMENT[department as OrgDepartment] ?? []

  const handleDepartmentChange = (v: string) => {
    setDepartment(v)
    setSubDepartment('__none__')
    setAvatarColor(defaultAvatarColorForDepartment(v))
  }

  const submit = async () => {
    if (!name.trim() || !title.trim()) return
    setLoading(true)
    try {
      const body = {
        name: name.trim(),
        title: title.trim(),
        department: department || null,
        subDepartment: subDepartment === '__none__' ? null : subDepartment.trim() || null,
        email: email.trim() || null,
        phone: phone.trim() || null,
        parentId,
        linkedUserId: linkedUserId === '__none__' ? null : linkedUserId,
        avatarColor,
      }
      if (mode === 'create') {
        const res = await fetch('/api/admin/org-chart/nodes', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify(body),
        })
        if (!res.ok) {
          const e = await res.json().catch(() => ({}))
          throw new Error(e.error || 'Failed to create')
        }
      } else if (editNode) {
        const res = await fetch(`/api/admin/org-chart/nodes/${editNode.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify(body),
        })
        if (!res.ok) {
          const e = await res.json().catch(() => ({}))
          throw new Error(e.error || 'Failed to save')
        }
      }
      onSaved()
      onOpenChange(false)
    } catch (e: unknown) {
      console.error(e)
      alert(e instanceof Error ? e.message : 'Save failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-lg overflow-y-auto dark:bg-[var(--bg-elevated)] dark:border-[var(--border-medium)]">
        <DialogHeader>
          <DialogTitle>{mode === 'create' ? 'Add person' : 'Edit person'}</DialogTitle>
          <DialogDescription className="dark:text-[var(--text-tertiary)]">
            {mode === 'create' ? 'Add a node to the org chart.' : 'Update this org chart node.'}
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-2">
          <div className="space-y-2">
            <Label htmlFor="org-name">Full name *</Label>
            <Input id="org-name" value={name} onChange={(e) => setName(e.target.value)} required />
          </div>
          <div className="space-y-2">
            <Label htmlFor="org-title">Job title *</Label>
            <Input id="org-title" value={title} onChange={(e) => setTitle(e.target.value)} required />
          </div>
          <div className="space-y-2">
            <Label>Department</Label>
            <Select value={department} onValueChange={handleDepartmentChange}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {ORG_DEPARTMENTS.map((d) => (
                  <SelectItem key={d} value={d}>
                    <span className="flex items-center gap-2">
                      <span
                        className="inline-block h-3 w-3 rounded-full"
                        style={{ backgroundColor: defaultAvatarColorForDepartment(d) }}
                      />
                      {d}
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Subgroup (optional)</Label>
            <Select value={subDepartment} onValueChange={setSubDepartment}>
              <SelectTrigger>
                <SelectValue placeholder="None" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">None</SelectItem>
                {subOptionsForDept.map((s) => (
                  <SelectItem key={s} value={s}>
                    {s}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="org-parent-q">Reports to</Label>
            <Input
              id="org-parent-q"
              placeholder="Search manager..."
              value={parentQuery}
              onChange={(e) => setParentQuery(e.target.value)}
            />
            <Select
              value={parentId ?? '__root__'}
              onValueChange={(v) => setParentId(v === '__root__' ? null : v)}
            >
              <SelectTrigger>
                <SelectValue placeholder="None (top level)" />
              </SelectTrigger>
              <SelectContent className="max-h-48">
                <SelectItem value="__root__">None (top level)</SelectItem>
                {parentChoices.map((n) => (
                  <SelectItem key={n.id} value={n.id}>
                    {n.name} — {n.title}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="org-email">Email</Label>
            <Input id="org-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="org-phone">Phone</Label>
            <Input id="org-phone" type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>Link to system user</Label>
            <Select value={linkedUserId} onValueChange={setLinkedUserId}>
              <SelectTrigger>
                <SelectValue placeholder="Optional" />
              </SelectTrigger>
              <SelectContent className="max-h-48">
                <SelectItem value="__none__">None</SelectItem>
                {users.map((u) => (
                  <SelectItem key={u.id} value={u.id}>
                    {(u.name || u.email || u.id).slice(0, 48)} ({u.role})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="org-avatar">Avatar color</Label>
            <div className="flex items-center gap-3">
              <input
                id="org-avatar"
                type="color"
                className="h-10 w-14 cursor-pointer rounded border border-gray-200 bg-white"
                value={avatarColor}
                onChange={(e) => setAvatarColor(e.target.value)}
              />
              <span className="text-xs text-gray-500 dark:text-[var(--text-tertiary)]">{avatarColor}</span>
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button type="button" onClick={submit} disabled={loading || !name.trim() || !title.trim()}>
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Save'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
