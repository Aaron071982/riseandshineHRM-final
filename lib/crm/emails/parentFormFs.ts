import fs from 'fs'
import path from 'path'

/** Prefer public/ (always on Vercel) then email-docs/ then assets/. Server-only. */
export function parentFormSearchDirs(): string[] {
  return [
    path.join(process.cwd(), 'public', 'parent-forms'),
    path.join(process.cwd(), 'email-docs'),
    path.join(process.cwd(), 'assets', 'crm-parent-forms'),
  ]
}

export function resolveParentFormPath(fileName: string): string | null {
  const safe = path.basename(fileName)
  for (const dir of parentFormSearchDirs()) {
    const full = path.join(dir, safe)
    if (fs.existsSync(full)) return full
  }
  return null
}
