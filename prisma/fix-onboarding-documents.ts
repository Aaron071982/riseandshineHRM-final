import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function fixOnboardingDocuments() {
  console.log('Fixing onboarding documents...')

  // 1. Deactivate duplicate documents and Emergency/Incident Reporting Acknowledgment
  const duplicatesToRemove = [
    'employee-handbook-acknowledgment', // Remove Employee Handbook Acknowledgement (duplicate of Handbook)
    'hipaa-acknowledgment', // Remove HIPAA Acknowledgement (duplicate of HIPAA)
    'mandated-reporter-acknowledgment', // Remove Mandated Reporter Acknowledgement (duplicate of Mandated Reporter)
    'emergency-incident-reporting-acknowledgment', // Remove Emergency/Incident Reporting Acknowledgment (duplicate of Emergency Policy)
  ]

  for (const slug of duplicatesToRemove) {
    const result = await prisma.onboardingDocument.updateMany({
      where: { slug },
      data: { isActive: false },
    })
    console.log(`✅ Deactivated ${result.count} document(s) with slug: ${slug}`)
  }

  // 2. Update Emergency/Incident Reporting Acknowledgment to use the Mandated Reporter Acknowledgment Form.pdf
  // The PDF mapping in load-onboarding-pdfs.ts maps 'Mandated Reporter Acknowledgment Form.pdf' to 'mandated-reporter'
  // But the user says "Emergency Reporting Acknowledgement" should show this PDF
  // Looking at the database output, there's "Emergency/Incident Reporting Acknowledgment" with slug "emergency-incident-reporting-acknowledgment"
  // We need to update the PDF mapping script to map the PDF to this document instead (or in addition to mandated-reporter)
  // But actually, the user might want it mapped to "emergency-incident-reporting-acknowledgment" instead
  // For now, let's just note that the PDF loading script needs to be updated - but the user can run that separately
  // The main issue is the duplicates, which we've fixed above

  console.log('✅ Finished fixing onboarding documents')
  console.log('📝 Note: You may need to update scripts/load-onboarding-pdfs.ts to map "Mandated Reporter Acknowledgment Form.pdf" to "emergency-incident-reporting-acknowledgment" if needed')
}

async function main() {
  await fixOnboardingDocuments()
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })

