import { cookies } from 'next/headers'

const GRAPH_TOKEN_COOKIE = 'ms_graph_delegated_token'

/** Whether real Microsoft Graph sendMail is enabled (M365 admin consent). */
export function graphEmailEnabled(): boolean {
  return process.env.GRAPH_EMAIL_ENABLED === 'true'
}

export type GraphSendPayload = {
  accessToken: string
  fromAddress: string
  to: string[]
  cc?: string[]
  subject: string
  html: string
  text: string
}

export type GraphSendResult =
  | { ok: true }
  | { ok: false; error: string; noToken?: boolean }

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
  const fromCookie = cookieStore.get(GRAPH_TOKEN_COOKIE)?.value?.trim()
  if (fromCookie) return fromCookie

  // Future: load from user-linked token store keyed by userId
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
    const message = {
      subject: payload.subject,
      body: { contentType: 'HTML', content: payload.html },
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
    }

    const res = await fetch('https://graph.microsoft.com/v1.0/me/sendMail', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${payload.accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ message, saveToSentItems: true }),
    })

    if (!res.ok) {
      const detail = await res.text().catch(() => '')
      return {
        ok: false,
        error: `Graph sendMail failed (${res.status})${detail ? `: ${detail.slice(0, 200)}` : ''}`,
      }
    }

    return { ok: true }
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : String(err),
    }
  }
}
