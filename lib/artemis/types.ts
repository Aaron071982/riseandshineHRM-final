export type PayerType = 'Medicaid' | 'Commercial' | 'Tricare'

export interface Session {
  id: string
  date: string // ISO yyyy-mm-dd
  week: string // ISO Monday of that week
  client: string
  clientId: string
  payer: string
  payerType: PayerType
  cpt: string
  provider: string
  providerRole: string
  sessionStatus: string // Scheduled | In Progress | Incomplete | Completed | Ready to Bill | Cancelled | Deleted
  claimNo: string
  claimStatus: string // "" | Submitted | Paid | Denied | Client
  unitsScheduled: number
  unitsRendered: number
  charge: number // Billed Amount (gross)
  allowed: number // Practice Fee (contracted/expected)
  rateFromFile: number | null // allowed/unit when file carries dollars
  paidAlloc: number // de-duplicated claim paid
}

export interface IngestResult {
  sessions: Session[]
  hasRealMoney: boolean
  source: string
}

export type Rates = Record<PayerType, Record<string, number>>
