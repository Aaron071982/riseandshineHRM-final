export type QuizQuestion = {
  id: number
  question: string
  options: { id: string; label: string }[]
  correctOptionId: string
  explanation: string
}

export const SEXUAL_HARASSMENT_QUIZ_QUESTIONS: QuizQuestion[] = [
  {
    id: 1,
    question: 'Under New York State law, sexual harassment:',
    options: [
      { id: 'A', label: 'Must be severe AND pervasive to be illegal' },
      { id: 'B', label: 'Does not need to be severe or pervasive to be illegal' },
      { id: 'C', label: 'Only applies to physical contact' },
      { id: 'D', label: 'Only applies between employees of opposite genders' },
    ],
    correctOptionId: 'B',
    explanation: 'NY law does not require severity and pervasiveness for unlawful harassment.',
  },
  {
    id: 2,
    question: 'Which of the following is an example of sexual harassment?',
    options: [
      { id: 'A', label: 'Asking a colleague about their weekend plans' },
      { id: 'B', label: 'Giving a coworker constructive feedback on their work' },
      { id: 'C', label: 'Sending a sexually suggestive meme to a coworker via text' },
      { id: 'D', label: "Complimenting someone's professional accomplishments" },
    ],
    correctOptionId: 'C',
    explanation: 'Sexually suggestive communications to coworkers can constitute harassment.',
  },
  {
    id: 3,
    question: 'Sexual harassment can occur:',
    options: [
      { id: 'A', label: 'Only in the physical workplace' },
      { id: 'B', label: 'Only between a supervisor and a subordinate' },
      {
        id: 'C',
        label:
          'In the workplace, at off-site events, during travel, and through electronic communications',
      },
      { id: 'D', label: 'Only during working hours' },
    ],
    correctOptionId: 'C',
    explanation: 'Harassment is not limited to the primary worksite or business hours.',
  },
  {
    id: 4,
    question: "Who is protected under Rise & Shine ABA's Sexual Harassment Prevention Policy?",
    options: [
      { id: 'A', label: 'Only full-time employees' },
      { id: 'B', label: 'Only employees who have been with the company over 90 days' },
      {
        id: 'C',
        label: 'All employees, contractors, vendors, interns, applicants, and clients',
      },
      { id: 'D', label: 'Only employees in supervisory roles' },
    ],
    correctOptionId: 'C',
    explanation: 'The policy applies broadly to everyone connected with the organization.',
  },
  {
    id: 5,
    question: 'If you witness sexual harassment happening to a coworker, you should:',
    options: [
      { id: 'A', label: "Ignore it — it's not your business" },
      { id: 'B', label: 'Wait to see if it happens again before reporting' },
      { id: 'C', label: 'Only report it if the victim asks you to' },
      {
        id: 'D',
        label: 'Report it to a supervisor, HR, or the anonymous reporting channel',
      },
    ],
    correctOptionId: 'D',
    explanation: 'Bystanders should report harassment through proper channels.',
  },
  {
    id: 6,
    question: 'Quid pro quo harassment means:',
    options: [
      { id: 'A', label: 'Two coworkers mutually agreeing to a relationship' },
      { id: 'B', label: 'Harassment that occurs outside the workplace' },
      {
        id: 'C',
        label: 'A supervisor conditioning employment benefits on sexual favors',
      },
      { id: 'D', label: 'Online harassment through social media' },
    ],
    correctOptionId: 'C',
    explanation: 'Quid pro quo is conditioning job benefits on sexual conduct.',
  },
  {
    id: 7,
    question: 'Which of the following is TRUE about retaliation?',
    options: [
      { id: 'A', label: 'Minor retaliation is acceptable if the harassment complaint was minor' },
      {
        id: 'B',
        label: 'Retaliation is only prohibited if the original harassment complaint was proven true',
      },
      {
        id: 'C',
        label:
          'Retaliation against anyone who reports harassment in good faith is prohibited and is itself a policy violation',
      },
      {
        id: 'D',
        label:
          "Supervisors may reduce an employee's hours if they file a harassment complaint, as long as they don't fire them",
      },
    ],
    correctOptionId: 'C',
    explanation: 'Retaliation for good-faith reports is independently prohibited.',
  },
  {
    id: 8,
    question: 'How long does an employee have to file a sexual harassment complaint with the NYS Division of Human Rights?',
    options: [
      { id: 'A', label: '90 days' },
      { id: 'B', label: '1 year' },
      { id: 'C', label: '3 years' },
      { id: 'D', label: '10 years' },
    ],
    correctOptionId: 'C',
    explanation: 'Employees generally have three years to file with NYSDHR.',
  },
  {
    id: 9,
    question: 'At Rise & Shine ABA, sexual harassment training is required:',
    options: [
      { id: 'A', label: 'Once, at hire only' },
      { id: 'B', label: 'Every 3 years' },
      { id: 'C', label: 'Only for supervisors and managers' },
      { id: 'D', label: 'Within 30 days of hire and annually thereafter' },
    ],
    correctOptionId: 'D',
    explanation: 'NY requires training within 30 days of hire and annually.',
  },
  {
    id: 10,
    question: 'Which of the following is NOT a permitted reporting option for sexual harassment at Rise & Shine ABA?',
    options: [
      { id: 'A', label: 'Reporting to your supervisor or Case Coordinator' },
      { id: 'B', label: 'Emailing HR at info@riseandshine.nyc' },
      { id: 'C', label: 'Filing directly with the EEOC or NY Division of Human Rights' },
      { id: 'D', label: 'Posting about it on social media and tagging the company' },
    ],
    correctOptionId: 'D',
    explanation: 'Use official reporting channels — not public social media posts.',
  },
]

export const QUIZ_PASS_SCORE = 8
export const QUIZ_TOTAL_QUESTIONS = 10
