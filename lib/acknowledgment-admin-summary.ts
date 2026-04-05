/**
 * Admin UI copy: short description of what an acknowledgment document covers,
 * plus how the signer attested (from stored acknowledgmentJson).
 */

export const ACK_DOCUMENT_TOPIC_BY_SLUG: Record<string, string> = {
  handbook: 'Company handbook, workplace policies, and employment-related expectations.',
  hipaa: 'Protected health information (PHI), privacy practices, and HIPAA responsibilities.',
  'mandated-reporter': 'Mandated reporter responsibilities and reporting obligations.',
  nda: 'Confidentiality, non-disclosure, and protection of sensitive business information.',
  'emergency-policy': 'Emergency procedures, safety expectations, and incident response.',
}

export type AcknowledgmentJsonLike = {
  readConfirmed?: boolean
  agreeConfirmed?: boolean
  signatureConsentGiven?: boolean
  consentStatement?: string
  typedName?: string
}

function topicForDocument(slug: string | undefined, title: string): string {
  const s = slug?.trim().toLowerCase()
  if (s && ACK_DOCUMENT_TOPIC_BY_SLUG[s]) {
    return ACK_DOCUMENT_TOPIC_BY_SLUG[s]
  }
  return `The policies and terms in “${title}” as presented at signing.`
}

/** One or two sentences for admin cards: what the document is about + what they attested to. */
export function getAcknowledgmentAdminSummary(args: {
  documentTitle: string
  documentSlug?: string | null
  acknowledgmentJson?: unknown
}): { topic: string; attestation: string } {
  const topic = topicForDocument(args.documentSlug ?? undefined, args.documentTitle)
  const raw = args.acknowledgmentJson as AcknowledgmentJsonLike | null | undefined
  const read = raw?.readConfirmed === true
  const agree = raw?.agreeConfirmed === true
  const esign = raw?.signatureConsentGiven === true || Boolean(raw?.consentStatement)

  if (read && agree && esign) {
    return {
      topic,
      attestation:
        'They confirmed they read the full document, agreed to its terms, and accepted that their electronic signature is legally equivalent to a handwritten signature on this document.',
    }
  }
  if (read && agree) {
    return {
      topic,
      attestation:
        'They confirmed they read the full document and agreed to its terms.',
    }
  }
  return {
    topic,
    attestation:
      'They completed this acknowledgment and applied their signature to this document as recorded below.',
  }
}
