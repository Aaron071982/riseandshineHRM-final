/** Shared quiz question shape for org training (safe for client imports). */
export type OrgTrainingQuizQuestion = {
  id: string
  prompt: string
  options: string[]
  correctIndex: number
}
