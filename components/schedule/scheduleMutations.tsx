'use client'

import { createContext, useContext } from 'react'
import type { ScheduleClient, ScheduleSlot } from '@/lib/schedule/types'
import {
  bulkDeleteSlots,
  bulkUpdateSlots,
  createSlot,
  deleteSlot,
  updateSlot,
} from '@/lib/schedule/actions'

/**
 * Session writes used by the schedule views. The live implementation calls server actions;
 * inside a scenario tab the workspace provides a sandbox implementation that only edits the scenario.
 */
export type ScheduleMutations = {
  sandbox: boolean
  createSlot: (input: Record<string, unknown>) => Promise<ScheduleSlot>
  updateSlot: (id: string, patch: Record<string, unknown>) => Promise<ScheduleSlot>
  deleteSlot: (id: string) => Promise<void>
  bulkUpdateSlots: (ids: string[], patch: { status?: string; therapistId?: string }) => Promise<void>
  bulkDeleteSlots: (ids: string[]) => Promise<void>
  /** Sandbox only. */
  pauseClient?: (client: ScheduleClient) => Promise<void>
  resumeClient?: (clientId: string) => Promise<void>
  isClientPaused?: (clientId: string) => boolean
}

export const liveScheduleMutations: ScheduleMutations = {
  sandbox: false,
  createSlot: async (input) => (await createSlot(input)) as ScheduleSlot,
  updateSlot: async (id, patch) => (await updateSlot(id, patch)) as ScheduleSlot,
  deleteSlot: (id) => deleteSlot(id),
  bulkUpdateSlots: (ids, patch) => bulkUpdateSlots(ids, patch),
  bulkDeleteSlots: (ids) => bulkDeleteSlots(ids),
}

export const ScheduleMutationsContext = createContext<ScheduleMutations>(liveScheduleMutations)

export function useScheduleMutations(): ScheduleMutations {
  return useContext(ScheduleMutationsContext)
}
