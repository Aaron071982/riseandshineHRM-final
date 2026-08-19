import { describe, expect, it } from 'vitest'
import {
  classifyDatabaseTarget,
  dbHostFromUrl,
  parseWriteFlags,
  shouldRefuseNonDev,
  assertWriteTarget,
  WriteTargetError,
} from './guard'

describe('write-script guard', () => {
  it('parses dry-run by default', () => {
    expect(parseWriteFlags([])).toEqual({
      confirm: false,
      prodConfirm: false,
      dryRun: true,
    })
    expect(parseWriteFlags(['--confirm'])).toMatchObject({
      confirm: true,
      dryRun: false,
    })
    expect(parseWriteFlags(['--allow-prod'])).toMatchObject({
      prodConfirm: true,
    })
    expect(parseWriteFlags(['--prod-confirm'])).toMatchObject({
      prodConfirm: true,
    })
  })

  it('extracts host from postgres URLs', () => {
    expect(
      dbHostFromUrl('postgresql://u:p@db.gqfnqsxwoyrjphgcrzga.supabase.co:5432/postgres')
    ).toBe('db.gqfnqsxwoyrjphgcrzga.supabase.co')
  })

  it('classifies dev vs non-dev by project ref', () => {
    const url = 'postgresql://u:p@db.gqfnqsxwoyrjphgcrzga.supabase.co:5432/postgres'
    expect(classifyDatabaseTarget(url, 'gqfnqsxwoyrjphgcrzga').isDev).toBe(true)
    expect(classifyDatabaseTarget(url, 'otherref').isDev).toBe(false)
  })

  it('refuses non-dev without prod-confirm', () => {
    expect(shouldRefuseNonDev(true, false)).toBe(false)
    expect(shouldRefuseNonDev(false, false)).toBe(true)
    expect(shouldRefuseNonDev(false, true)).toBe(false)
  })

  it('throws when allowProd is false and target is not dev', () => {
    expect(() =>
      assertWriteTarget({
        allowProd: false,
        exit: false,
        argv: ['--confirm'],
        databaseUrl: 'postgresql://u:p@db.prod-project.supabase.co:5432/postgres',
      })
    ).toThrow(WriteTargetError)
  })

  it('allows dry-run against prod when --prod-confirm and allowProd', () => {
    const t = assertWriteTarget({
      allowProd: true,
      exit: false,
      argv: ['--prod-confirm'],
      databaseUrl: 'postgresql://u:p@db.prod-project.supabase.co:5432/postgres',
    })
    expect(t.dryRun).toBe(true)
    expect(t.isDev).toBe(false)
  })
})
