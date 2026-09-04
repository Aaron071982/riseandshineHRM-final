/** Default target mastery: 6 months after the current month, as MM/YYYY. */
export function defaultTargetMasteryDate(from: Date = new Date()): string {
  const d = new Date(from.getFullYear(), from.getMonth() + 6, 1)
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  return `${mm}/${d.getFullYear()}`
}
