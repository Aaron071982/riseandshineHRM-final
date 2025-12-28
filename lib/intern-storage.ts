// DEV ONLY — NOT FOR PRODUCTION — NO DB
// Local JSON file storage for intern candidates and interns
// This is a temporary solution for localhost development only

import { promises as fs } from 'fs'
import path from 'path'

const STORAGE_FILE = path.join(process.cwd(), 'tmp', 'interns.dev.json')

export type InternCandidateStatus = 'Applied' | 'Interview Scheduled' | 'Interview Completed' | 'Hired' | 'Rejected'
export type InternStatus = 'Active' | 'Inactive'

export interface InternCandidate {
  id: string
  name: string
  email: string
  phone?: string
  role: string
  status: InternCandidateStatus
  interviewNotes?: string
  interviewDate?: string
  interviewTime?: string
  interviewLocation?: string
  meetingUrl?: string
  createdAt: string
  updatedAt: string
}

export interface Intern {
  id: string
  candidateId?: string // Link to original candidate if hired
  name: string
  email: string
  phone?: string
  role: string
  status: InternStatus
  expectedHoursPerWeek?: number
  createdAt: string
  updatedAt: string
}

interface StorageData {
  internCandidates: InternCandidate[]
  interns: Intern[]
}

async function ensureStorageFile(): Promise<void> {
  const dir = path.dirname(STORAGE_FILE)
  try {
    await fs.mkdir(dir, { recursive: true })
  } catch (error) {
    // Directory might already exist
  }
  
  try {
    await fs.access(STORAGE_FILE)
  } catch {
    // File doesn't exist, create with empty data
    const initialData: StorageData = {
      internCandidates: [],
      interns: [],
    }
    await fs.writeFile(STORAGE_FILE, JSON.stringify(initialData, null, 2))
  }
}

async function readData(): Promise<StorageData> {
  await ensureStorageFile()
  const content = await fs.readFile(STORAGE_FILE, 'utf-8')
  return JSON.parse(content)
}

async function writeData(data: StorageData): Promise<void> {
  await ensureStorageFile()
  await fs.writeFile(STORAGE_FILE, JSON.stringify(data, null, 2))
}

export async function getAllCandidates(): Promise<InternCandidate[]> {
  const data = await readData()
  return data.internCandidates
}

export async function getCandidateById(id: string): Promise<InternCandidate | null> {
  const data = await readData()
  return data.internCandidates.find(c => c.id === id) || null
}

export async function createCandidate(candidate: Omit<InternCandidate, 'id' | 'createdAt' | 'updatedAt'>): Promise<InternCandidate> {
  const data = await readData()
  const newCandidate: InternCandidate = {
    ...candidate,
    id: crypto.randomUUID(),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  }
  data.internCandidates.push(newCandidate)
  await writeData(data)
  return newCandidate
}

export async function updateCandidate(id: string, updates: Partial<InternCandidate>): Promise<InternCandidate | null> {
  const data = await readData()
  const index = data.internCandidates.findIndex(c => c.id === id)
  if (index === -1) return null
  
  const updated = {
    ...data.internCandidates[index],
    ...updates,
    id, // Prevent ID changes
    updatedAt: new Date().toISOString(),
  }
  data.internCandidates[index] = updated
  await writeData(data)
  return updated
}

export async function deleteCandidate(id: string): Promise<boolean> {
  const data = await readData()
  const index = data.internCandidates.findIndex(c => c.id === id)
  if (index === -1) return false
  
  data.internCandidates.splice(index, 1)
  await writeData(data)
  return true
}

export async function getAllInterns(): Promise<Intern[]> {
  const data = await readData()
  return data.interns
}

export async function getInternById(id: string): Promise<Intern | null> {
  const data = await readData()
  return data.interns.find(i => i.id === id) || null
}

export async function createIntern(intern: Omit<Intern, 'id' | 'createdAt' | 'updatedAt'>): Promise<Intern> {
  const data = await readData()
  const newIntern: Intern = {
    ...intern,
    id: crypto.randomUUID(),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  }
  data.interns.push(newIntern)
  await writeData(data)
  return newIntern
}

export async function updateIntern(id: string, updates: Partial<Intern>): Promise<Intern | null> {
  const data = await readData()
  const index = data.interns.findIndex(i => i.id === id)
  if (index === -1) return null
  
  const updated = {
    ...data.interns[index],
    ...updates,
    id, // Prevent ID changes
    updatedAt: new Date().toISOString(),
  }
  data.interns[index] = updated
  await writeData(data)
  return updated
}

export async function deleteIntern(id: string): Promise<boolean> {
  const data = await readData()
  const index = data.interns.findIndex(i => i.id === id)
  if (index === -1) return false
  
  data.interns.splice(index, 1)
  await writeData(data)
  return true
}


