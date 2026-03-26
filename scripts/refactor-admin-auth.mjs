#!/usr/bin/env node
/**
 * One-off: replace cookie + validateSession + role check with requireAdminSession() in admin API routes.
 * Run from repo root: node scripts/refactor-admin-auth.mjs
 */
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.join(__dirname, '..')
const adminApi = path.join(root, 'app/api/admin')

const multilineBlock = `    const cookieStore = await cookies()
    const sessionToken = cookieStore.get('session')?.value

    if (!sessionToken) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const user = await validateSession(sessionToken)
    if (!user || user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

`
const compactBlock = `    const cookieStore = await cookies()
    const sessionToken = cookieStore.get('session')?.value
    if (!sessionToken) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const user = await validateSession(sessionToken)
    if (!user || user.role !== 'ADMIN') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

`

const newBlock = `    const auth = await requireAdminSession()
    if (auth.response) return auth.response
    const user = auth.user

`

function walk(dir, list = []) {
  const entries = fs.readdirSync(dir, { withFileTypes: true })
  for (const e of entries) {
    const full = path.join(dir, e.name)
    if (e.isDirectory()) walk(full, list)
    else if (e.name === 'route.ts') list.push(full)
  }
  return list
}

const routes = walk(adminApi)
let changed = 0
for (const file of routes) {
  let content = fs.readFileSync(file, 'utf8')
  if (!content.includes("user.role !== 'ADMIN'")) continue
  if (content.includes('requireAdminSession()')) continue
  const orig = content
  content = content.replace(multilineBlock, newBlock)
  content = content.replace(compactBlock, newBlock)
  if (content === orig) continue
  content = content.replace(/import \{ cookies \} from 'next\/headers'\n/, '')
  content = content.replace(/import \{ validateSession \} from '@\/lib\/auth'/, "import { requireAdminSession } from '@/lib/auth'")
  content = content.replace(/import \{ validateSession, ([^}]+) \} from '@\/lib\/auth'/, "import { requireAdminSession, $1 } from '@/lib/auth'")
  if (content.includes('requireAdminSession') && content.includes('cookies')) {
    content = content.replace(/import \{ cookies \} from 'next\/headers'\n?/, '')
  }
  fs.writeFileSync(file, content)
  changed++
  console.log('Updated', path.relative(root, file))
}
console.log('Total updated:', changed)
