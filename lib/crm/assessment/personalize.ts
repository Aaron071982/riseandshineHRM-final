/**
 * Replace generic "Client" / "the client" wording with the child's name
 * throughout assessment boilerplate and stored narrative fields.
 */
export function personalizeClientReferences(
  text: string,
  clientName: string
): string {
  const name = clientName.trim()
  if (!name || !text) return text

  return (
    text
      // Longer / more specific phrases first
      .replace(/\ba\s+[Cc]lient's\b/g, `${name}'s`)
      .replace(/\bthe\s+[Cc]lient's\b/g, `${name}'s`)
      .replace(/\bthe\s+individual\s+client\b/gi, name)
      .replace(/\bindividual\s+client\b/gi, name)
      .replace(/\bthe\s+[Cc]lient\b/g, name)
      .replace(/\bClient's\b/g, `${name}'s`)
      .replace(/\bClient\b/g, name)
  )
}

export function personalizeAssessmentValue<T>(value: T, clientName: string): T {
  if (typeof value === 'string') {
    return personalizeClientReferences(value, clientName) as T
  }
  if (Array.isArray(value)) {
    return value.map((item) => personalizeAssessmentValue(item, clientName)) as T
  }
  if (value && typeof value === 'object') {
    const out: Record<string, unknown> = {}
    for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
      out[key] = personalizeAssessmentValue(child, clientName)
    }
    return out as T
  }
  return value
}
