import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function removeDuplicateDocuments() {
  console.log('Removing duplicate onboarding documents...')

  // Deactivate duplicate documents by setting isActive to false
  const duplicatesToRemove = [
    'employee-handbook-acknowledgement',
    'hipaa-acknowledgement',
    'mandated-reporter-acknowledgement',
  ]

  for (const slug of duplicatesToRemove) {
    const result = await prisma.onboardingDocument.updateMany({
      where: { slug },
      data: { isActive: false },
    })
    console.log(`Deactivated ${result.count} document(s) with slug: ${slug}`)
  }

  // Update Emergency Policy to use the correct PDF filename
  // The user mentioned it should show "Mandated Reporter Acknowledgment Form.pdf"
  // But looking at the seed file, it's "Emergency Policy" with slug "emergency-policy"
  // We'll update the title if needed, but the user said "Emergency Reporting Acknowledgement" should show the PDF
  // Let me check what they want - they said "emergency reporting acknowledgement says pdf not available but should be showing Mandated Reporter Acknowledgment Form.pdf"
  
  // Actually, based on the user's request, it seems like "Emergency Reporting Acknowledgement" might be a different document
  // But in the seed file I only see "Emergency Policy" with slug "emergency-policy"
  // The user might be referring to a document that exists in the DB but not in the seed file
  
  console.log('✅ Finished removing duplicate documents')
}

async function main() {
  await removeDuplicateDocuments()
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })

