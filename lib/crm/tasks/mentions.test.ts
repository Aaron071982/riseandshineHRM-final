import { describe, expect, it } from 'vitest'
import {
  applyMentionPick,
  formatDeptMentionDisplay,
  parseMentionTargets,
  splitMentionBody,
} from '@/lib/crm/tasks/mentions'

describe('parseMentionTargets', () => {
  it('parses multiple users and departments', () => {
    const body = `Please review @[Jordan](user1) and @[Intake](dept:INTAKE) with @[Sam](user2)`
    const out = parseMentionTargets(body)
    expect(out.userIds).toEqual(['user1', 'user2'])
    expect(out.depts).toEqual(['INTAKE'])
    expect(out.tokens).toHaveLength(3)
  })
})

describe('applyMentionPick', () => {
  it('allows multiple mention tokens in one message', () => {
    let text = 'Hi @jor'
    text = applyMentionPick(text, 'Jordan', 'user1')
    text = `${text.trim()} cc @int`
    text = applyMentionPick(text, 'Intake', 'dept:INTAKE')
    expect(text).toContain('@[Jordan](user1)')
    expect(text).toContain('@[Intake](dept:INTAKE)')
  })
})

describe('splitMentionBody', () => {
  it('splits mention tokens for rendering', () => {
    const body = `Hey ${formatDeptMentionDisplay('Clinical', 'CLINICAL')} team`
    const parts = splitMentionBody(body)
    expect(parts).toEqual([
      { type: 'text', value: 'Hey ' },
      { type: 'mention', value: 'Clinical' },
      { type: 'text', value: ' team' },
    ])
  })
})
