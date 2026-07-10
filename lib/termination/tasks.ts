import type { OffboardingTaskType } from '@prisma/client'
import { ALL_OFFBOARDING_TASK_TYPES } from './constants'

export function seedOffboardingTaskTypes(): OffboardingTaskType[] {
  return ALL_OFFBOARDING_TASK_TYPES as OffboardingTaskType[]
}

export function allTasksComplete(tasks: { completed: boolean }[]): boolean {
  return tasks.length > 0 && tasks.every((t) => t.completed)
}
