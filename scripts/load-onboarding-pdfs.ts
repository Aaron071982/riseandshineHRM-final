import { PrismaClient } from '@prisma/client'
import { readFile } from 'fs/promises'
import { join } from 'path'

const prisma = new PrismaClient()

// Map PDF filenames to document slugs
const pdfFileMapping: Record<string, string> = {
  'Employee Handbook.pdf': 'handbook',
  'HIPAA Acknowledgment Form.pdf': 'hipaa',
  'Mandated Reporter Acknowledgment Form.pdf': 'mandated-reporter',
  'Non-Disclosure Agreement _NDA_.pdf': 'nda',
  'Emergency _ Incident Reporting Policy Acknowledgment.pdf': 'emergency-policy',
  'BackgroundCheckLetter.pdf': 'background-check-authorization',
  'I-9 Employment Eligibility Verification.pdf': 'i9',
  '2025 Form W-4.pdf': 'w4',
  'Direct Deposit Authorization Form.pdf': 'direct-deposit-authorization',
}

async function loadOnboardingPDFs() {
  console.log('Loading PDFs from onboarding documents folder...')

  const pdfFolderPath = join(process.cwd(), 'onboarding documents')

  for (const [filename, slug] of Object.entries(pdfFileMapping)) {
    try {
      const filePath = join(pdfFolderPath, filename)
      
      // Read PDF file
      const fileBuffer = await readFile(filePath)
      const base64Data = fileBuffer.toString('base64')

      // Update document in database
      await prisma.onboardingDocument.update({
        where: { slug },
        data: {
          pdfData: base64Data,
        },
      })

      console.log(`✅ Loaded ${filename} → ${slug}`)
    } catch (error: any) {
      if (error.code === 'ENOENT') {
        console.warn(`⚠️  File not found: ${filename}`)
      } else {
        console.error(`❌ Error loading ${filename}:`, error.message)
      }
    }
  }

  console.log('✅ PDF loading complete')
}

async function main() {
  await loadOnboardingPDFs()
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })

