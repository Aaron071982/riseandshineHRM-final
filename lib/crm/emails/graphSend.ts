import { cookies } from 'next/headers'
import { runtimeEnvFlag } from '@/lib/env/runtimeFlag'
import { MICROSOFT_GRAPH_TOKEN_COOKIE } from '@/lib/auth/microsoft'

/** Whether real Microsoft Graph sendMail is enabled (M365 admin consent). */
export function graphEmailEnabled(): boolean {
  return runtimeEnvFlag('GRAPH_EMAIL_ENABLED')
}

export type GraphFileAttachment = {
  fileName: string
  contentType: string
  /** Raw file bytes — encoded to base64 for Graph. */
  contentBytes: Buffer
}

export type GraphSendPayload = {
  accessToken: string
  fromAddress: string
  to: string[]
  cc?: string[]
  subject: string
  html: string
  text: string
  attachments?: GraphFileAttachment[]
}

export type GraphSendResult =
  | { ok: true; usedAttachments: boolean }
  | { ok: false; error: string; noToken?: boolean }

const GRAPH_BASE = 'https://graph.microsoft.com/v1.0'
const RETRYABLE = new Set([429, 503, 504])
const MAX_ATTEMPTS = 4

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function authHeaders(accessToken: string, json = true): HeadersInit {
  return {
    Authorization: `Bearer ${accessToken}`,
    ...(json ? { 'Content-Type': 'application/json' } : {}),
  }
}

async function graphFetch(
  accessToken: string,
  path: string,
  init: RequestInit
): Promise<Response> {
  let last: Response | null = null
  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    const res = await fetch(`${GRAPH_BASE}${path}`, {
      ...init,
      headers: {
        ...authHeaders(accessToken, init.body != null),
        ...(init.headers ?? {}),
      },
    })
    last = res
    if (res.ok || !RETRYABLE.has(res.status)) return res

    const retryAfter = Number(res.headers.get('retry-after') || '')
    const delayMs = Number.isFinite(retryAfter) && retryAfter > 0
      ? retryAfter * 1000
      : 400 * 2 ** attempt + Math.floor(Math.random() * 200)
    await sleep(delayMs)
  }
  return last!
}

function messageBody(payload: GraphSendPayload, includeAttachments: boolean) {
  const graphAttachments =
    includeAttachments && payload.attachments?.length
      ? payload.attachments.map((a) => ({
          '@odata.type': '#microsoft.graph.fileAttachment',
          name: a.fileName,
          contentType: a.contentType || 'application/octet-stream',
          contentBytes: a.contentBytes.toString('base64'),
        }))
      : []

  return {
    subject: payload.subject,
    body: { contentType: 'HTML' as const, content: payload.html },
    toRecipients: payload.to.map((address) => ({
      emailAddress: { address },
    })),
    ...(payload.cc?.length
      ? {
          ccRecipients: payload.cc.map((address) => ({
            emailAddress: { address },
          })),
        }
      : {}),
    ...(graphAttachments.length ? { attachments: graphAttachments } : {}),
  }
}

async function sendMailSimple(
  payload: GraphSendPayload,
  includeAttachments: boolean
): Promise<GraphSendResult> {
  const res = await graphFetch(payload.accessToken, '/me/sendMail', {
    method: 'POST',
    body: JSON.stringify({
      message: messageBody(payload, includeAttachments),
      saveToSentItems: true,
    }),
  })

  if (!res.ok) {
    const detail = await res.text().catch(() => '')
    return {
      ok: false,
      error: `Graph sendMail failed (${res.status})${detail ? `: ${detail.slice(0, 240)}` : ''}`,
    }
  }
  return { ok: true, usedAttachments: includeAttachments && !!payload.attachments?.length }
}

/**
 * More reliable for multiple PDFs: create draft → add attachments one-by-one → send.
 * Avoids stuffing all base64 into a single sendMail payload (common 503 cause).
 */
async function sendMailViaDraft(
  payload: GraphSendPayload
): Promise<GraphSendResult> {
  const attachments = payload.attachments ?? []
  const createRes = await graphFetch(payload.accessToken, '/me/messages', {
    method: 'POST',
    body: JSON.stringify(messageBody(payload, false)),
  })
  if (!createRes.ok) {
    const detail = await createRes.text().catch(() => '')
    return {
      ok: false,
      error: `Graph create draft failed (${createRes.status})${detail ? `: ${detail.slice(0, 240)}` : ''}`,
    }
  }

  const draft = (await createRes.json()) as { id?: string }
  const draftId = draft.id?.trim()
  if (!draftId) {
    return { ok: false, error: 'Graph create draft returned no message id' }
  }

  for (const a of attachments) {
    const attachRes = await graphFetch(
      payload.accessToken,
      `/me/messages/${encodeURIComponent(draftId)}/attachments`,
      {
        method: 'POST',
        body: JSON.stringify({
          '@odata.type': '#microsoft.graph.fileAttachment',
          name: a.fileName,
          contentType: a.contentType || 'application/octet-stream',
          contentBytes: a.contentBytes.toString('base64'),
        }),
      }
    )
    if (!attachRes.ok) {
      const detail = await attachRes.text().catch(() => '')
      // Best-effort cleanup so failed drafts don't pile up.
      void graphFetch(
        payload.accessToken,
        `/me/messages/${encodeURIComponent(draftId)}`,
        { method: 'DELETE' }
      )
      return {
        ok: false,
        error: `Graph attach ${a.fileName} failed (${attachRes.status})${detail ? `: ${detail.slice(0, 200)}` : ''}`,
      }
    }
  }

  const sendRes = await graphFetch(
    payload.accessToken,
    `/me/messages/${encodeURIComponent(draftId)}/send`,
    { method: 'POST' }
  )
  if (!sendRes.ok) {
    const detail = await sendRes.text().catch(() => '')
    void graphFetch(
      payload.accessToken,
      `/me/messages/${encodeURIComponent(draftId)}`,
      { method: 'DELETE' }
    )
    return {
      ok: false,
      error: `Graph send draft failed (${sendRes.status})${detail ? `: ${detail.slice(0, 240)}` : ''}`,
    }
  }

  return { ok: true, usedAttachments: attachments.length > 0 }
}

/**
 * Resolve the signed-in user's delegated Graph token.
 * OAuth flow will populate the cookie; dev may use MICROSOFT_GRAPH_DELEGATED_TOKEN.
 */
export async function resolveDelegatedGraphToken(
  userId: string
): Promise<string | null> {
  const envToken = process.env.MICROSOFT_GRAPH_DELEGATED_TOKEN?.trim()
  if (envToken) return envToken

  const cookieStore = await cookies()
  const fromCookie = cookieStore.get(MICROSOFT_GRAPH_TOKEN_COOKIE)?.value?.trim()
  if (fromCookie) return fromCookie

  void userId
  return null
}

export async function sendMailViaGraph(
  payload: GraphSendPayload
): Promise<GraphSendResult> {
  if (!graphEmailEnabled()) {
    return { ok: false, error: 'GRAPH_EMAIL_ENABLED is not true' }
  }

  try {
    const hasAttachments = (payload.attachments?.length ?? 0) > 0

    if (hasAttachments) {
      const draftResult = await sendMailViaDraft(payload)
      if (draftResult.ok) return draftResult

      // Fallback 1: classic sendMail with attachments (retryable inside graphFetch).
      const withAttach = await sendMailSimple(payload, true)
      if (withAttach.ok) return withAttach

      // Fallback 2: send without binary PDFs — HTML already has download links.
      const withoutAttach = await sendMailSimple(payload, false)
      if (withoutAttach.ok) {
        return {
          ok: true,
          usedAttachments: false,
        }
      }

      return {
        ok: false,
        error: `${draftResult.error} | ${withAttach.error} | ${withoutAttach.error}`,
      }
    }

    return await sendMailSimple(payload, false)
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : String(err),
    }
  }
}
