'use client'

import { useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'

export type UseAdminFormSubmitOptions = {
  /** Default error message when response has no error text */
  defaultError?: string
  /** Redirect path when user cancels (optional) */
  cancelRedirect?: string
}

export type SubmitOptions = {
  url: string
  /** JSON body (sent with Content-Type: application/json). Omit if using formData. */
  body?: Record<string, unknown>
  /** FormData for multipart POST. Omit if using body. */
  formData?: FormData
  /** Called with response data on success; return path to redirect to. */
  successRedirect: (data: { id: string }) => string
}

/**
 * Hook for admin forms: loading state, error state, fetch, parse JSON error, router.push on success.
 * Use with JSON body (AddBCBA, AddBilling, AddMarketing, AddCallCenter) or FormData (e.g. AddRBT).
 */
export function useAdminFormSubmit(options: UseAdminFormSubmitOptions = {}) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const { defaultError = 'An error occurred. Please try again.', cancelRedirect } = options

  const submit = useCallback(
    async (args: SubmitOptions) => {
      const { url, body, formData, successRedirect } = args
      setError('')
      setLoading(true)
      try {
        const res = await fetch(url, {
          method: 'POST',
          ...(body != null
            ? { headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }
            : { body: formData }),
          credentials: 'include',
        })
        const data = await res.json()
        if (!res.ok) {
          setError((data?.error as string) || defaultError)
          setLoading(false)
          return
        }
        router.push(successRedirect(data))
      } catch {
        setError(defaultError)
      } finally {
        setLoading(false)
      }
    },
    [router, defaultError]
  )

  const goCancel = useCallback(() => {
    if (cancelRedirect) router.push(cancelRedirect)
  }, [router, cancelRedirect])

  return { submit, loading, error, setError, goCancel }
}
