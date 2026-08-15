/**
 * Scrub Clients_Master CSV → PHI-free copy for dev importer testing.
 *
 * Keeps Client ID / Status / Insurance / staffing / hours / doc columns.
 * Replaces names, DOB, address, parent contact with faker + @example.com.
 *
 * Usage:
 *   tsx scripts/scrub-clients-csv.ts [path/to/real.csv]
 * Default input: ~/Downloads/Clients(Master) (2).csv
 * Output: scripts/.tmp/clients_scrubbed.csv
 */
import fs from 'fs'
import path from 'path'
import os from 'os'
import { faker } from '@faker-js/faker'
import { parseCsv, toCsv } from './lib/csv'

const DEFAULT_INPUT = path.join(
  os.homedir(),
  'Downloads',
  'Clients(Master) (2).csv'
)
const OUT_DIR = path.join(process.cwd(), 'scripts', '.tmp')
const OUT_FILE = path.join(OUT_DIR, 'clients_scrubbed.csv')

const BOROUGHS = [
  'Bronx',
  'Brooklyn',
  'Queens',
  'Manhattan',
  'Staten Island',
] as const

function colIndex(headers: string[], name: string): number {
  const i = headers.findIndex((h) => h === name)
  if (i < 0) throw new Error(`Missing column: ${name}`)
  return i
}

function scrubAddress(original: string): string {
  const borough =
    BOROUGHS.find((b) => original.toLowerCase().includes(b.toLowerCase())) ??
    faker.helpers.arrayElement([...BOROUGHS])
  const street = faker.location.streetAddress()
  return `${street}, ${borough}, NY`
}

function main() {
  const inputPath = process.argv[2] || DEFAULT_INPUT
  if (!fs.existsSync(inputPath)) {
    console.error(`✋ Input not found: ${inputPath}`)
    process.exit(1)
  }

  const raw = fs.readFileSync(inputPath)
  const text = raw.toString('latin1')
  const { headers, rows } = parseCsv(text)

  const idIdx = colIndex(headers, 'Client ID')
  const nameIdx = colIndex(headers, 'Client Name')
  const dobIdx = colIndex(headers, 'DOB')
  const addrIdx = colIndex(headers, 'Address')
  const parentNameIdx = colIndex(headers, 'Parent Name')
  const parentPhoneIdx = colIndex(headers, 'Parent Number')
  const parentEmailIdx = colIndex(headers, 'Parent Email')
  const clientInfoIdx = headers.indexOf('Client Info')
  const parentInfoIdx = headers.indexOf('Parent Info')
  const insuranceIdx = headers.indexOf('Insurance')

  const outRows: string[][] = []
  let kept = 0

  for (const row of rows) {
    const clientId = (row[idIdx] ?? '').trim()
    if (!clientId) continue
    kept++

    const first = faker.person.firstName()
    const last = faker.person.lastName()
    const parentFirst = faker.person.firstName()
    const parentLast = faker.person.lastName()
    const parentName = `${parentFirst} ${parentLast}`
    const parentEmail = faker.internet
      .email({
        firstName: parentFirst,
        lastName: parentLast,
        provider: 'example.com',
      })
      .toLowerCase()
    const parentPhone = faker.phone.number({ style: 'national' })
    const dob = faker.date
      .birthdate({ min: 3, max: 17, mode: 'age' })
      .toLocaleDateString('en-US', {
        month: '2-digit',
        day: '2-digit',
        year: 'numeric',
      })
    const address = scrubAddress(row[addrIdx] ?? '')

    const next = [...row]
    while (next.length < headers.length) next.push('')

    next[nameIdx] = `${first} ${last}`
    next[dobIdx] = dob
    next[addrIdx] = address
    next[parentNameIdx] = parentName
    next[parentPhoneIdx] = parentPhone
    next[parentEmailIdx] = parentEmail

    if (clientInfoIdx >= 0) {
      const insurance =
        insuranceIdx >= 0 ? (row[insuranceIdx] ?? '').trim() : ''
      next[clientInfoIdx] =
        `${first} ${last}\nDOB: ${dob}\nAddress: ${address}\nInsurance: ${insurance}`
    }
    if (parentInfoIdx >= 0) {
      next[parentInfoIdx] =
        `${parentName}\nPhone: ${parentPhone}\nEmail: ${parentEmail}`
    }

    outRows.push(next)
  }

  fs.mkdirSync(OUT_DIR, { recursive: true })
  fs.writeFileSync(OUT_FILE, toCsv(headers, outRows), 'utf8')
  console.log(`✓ Scrubbed ${kept} clients → ${OUT_FILE}`)
  console.log(
    '  PHI fields replaced; Client ID / Status / staffing / docs preserved.'
  )
}

main()
