'use client'

import { useEffect, useState, useTransition } from 'react'

type Device = {
  id: string
  label: string
  locationLabel: string
  tokenLast4: string | null
  isActive: boolean
  createdAt: string
}

export default function KioskDevicesPanel() {
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState('')
  const [devices, setDevices] = useState<Device[]>([])
  const [label, setLabel] = useState('')
  const [locationLabel, setLocationLabel] = useState('')
  const [createdToken, setCreatedToken] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  const load = () => {
    startTransition(async () => {
      try {
        const res = await fetch('/api/client-services/kiosk-devices')
        const data = await res.json().catch(() => ({}))
        if (!res.ok) {
          setError(typeof data.error === 'string' ? data.error : 'Failed to load devices')
          return
        }
        setError('')
        setDevices(Array.isArray(data.devices) ? data.devices : [])
      } catch {
        setError('Failed to load devices')
      }
    })
  }

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const createDevice = () => {
    startTransition(async () => {
      setCopied(false)
      try {
        const res = await fetch('/api/client-services/kiosk-devices', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ label, locationLabel }),
        })
        const data = await res.json().catch(() => ({}))
        if (!res.ok) {
          setError(typeof data.error === 'string' ? data.error : 'Failed to create device')
          return
        }
        setError('')
        setLabel('')
        setLocationLabel('')
        setCreatedToken(typeof data.token === 'string' ? data.token : null)
        load()
      } catch {
        setError('Failed to create device')
      }
    })
  }

  const setActive = (id: string, isActive: boolean) => {
    startTransition(async () => {
      try {
        const res = await fetch(`/api/client-services/kiosk-devices/${id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ isActive }),
        })
        const data = await res.json().catch(() => ({}))
        if (!res.ok) {
          setError(typeof data.error === 'string' ? data.error : 'Failed to update device')
          return
        }
        setError('')
        load()
      } catch {
        setError('Failed to update device')
      }
    })
  }

  const copyToken = async () => {
    if (!createdToken) return
    try {
      await navigator.clipboard.writeText(createdToken)
      setCopied(true)
    } catch {
      setCopied(false)
    }
  }

  return (
    <section className="rounded-xl border border-line bg-surface p-4">
      <h2 className="font-display text-lg font-semibold text-ink">
        Check-in kiosk devices
      </h2>
      <p className="mt-0.5 text-sm text-quiet">
        Provision iPad / front-desk tokens. The plaintext token is shown once —
        copy it onto the device immediately.
      </p>

      {error && (
        <p className="mt-2 text-sm text-[var(--urgent)]">{error}</p>
      )}

      {createdToken && (
        <div
          role="alert"
          className="mt-3 rounded-lg border border-brand/40 bg-brand/5 px-3 py-2.5"
        >
          <p className="text-sm font-medium text-ink">
            New device token (shown once)
          </p>
          <p className="mt-1 break-all font-mono text-xs text-ink">{createdToken}</p>
          <div className="mt-2 flex flex-wrap gap-2">
            <button
              type="button"
              className="text-xs font-medium text-brand hover:underline"
              onClick={() => void copyToken()}
            >
              {copied ? 'Copied' : 'Copy token'}
            </button>
            <button
              type="button"
              className="text-xs font-medium text-quiet hover:underline"
              onClick={() => {
                setCreatedToken(null)
                setCopied(false)
              }}
            >
              Dismiss
            </button>
          </div>
        </div>
      )}

      <form
        className="mt-4 flex flex-wrap items-end gap-3"
        onSubmit={(e) => {
          e.preventDefault()
          createDevice()
        }}
      >
        <label className="flex min-w-[10rem] flex-1 flex-col gap-1 text-xs text-quiet">
          Label
          <input
            type="text"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder="Front desk iPad 1"
            className="rounded-lg border border-line bg-white px-3 py-2 text-sm text-ink"
            required
          />
        </label>
        <label className="flex min-w-[10rem] flex-1 flex-col gap-1 text-xs text-quiet">
          Location
          <input
            type="text"
            value={locationLabel}
            onChange={(e) => setLocationLabel(e.target.value)}
            placeholder="Brooklyn Center"
            className="rounded-lg border border-line bg-white px-3 py-2 text-sm text-ink"
            required
          />
        </label>
        <button
          type="submit"
          disabled={pending || !label.trim() || !locationLabel.trim()}
          className="rounded-lg bg-brand px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
        >
          Create device
        </button>
      </form>

      {devices.length === 0 && !pending ? (
        <p className="mt-4 text-sm text-quiet">No kiosk devices yet.</p>
      ) : (
        <ul className="mt-4 divide-y divide-line">
          {devices.map((d) => (
            <li
              key={d.id}
              className="flex flex-wrap items-center justify-between gap-2 py-2"
            >
              <div>
                <div className="text-sm font-medium text-ink">
                  {d.label}{' '}
                  {!d.isActive && (
                    <span className="text-xs font-normal text-[var(--urgent)]">
                      (revoked)
                    </span>
                  )}
                </div>
                <div className="text-xs text-quiet">
                  {d.locationLabel}
                  {d.tokenLast4 ? ` · …${d.tokenLast4}` : ''}
                  {' · '}
                  {new Date(d.createdAt).toLocaleString()}
                </div>
              </div>
              {d.isActive ? (
                <button
                  type="button"
                  disabled={pending}
                  className="text-xs font-medium text-[var(--urgent)] hover:underline disabled:opacity-50"
                  onClick={() => setActive(d.id, false)}
                >
                  Revoke
                </button>
              ) : (
                <button
                  type="button"
                  disabled={pending}
                  className="text-xs font-medium text-brand hover:underline disabled:opacity-50"
                  onClick={() => setActive(d.id, true)}
                >
                  Reactivate
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
