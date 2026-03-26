import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

const onboardingDocuments = [
  // 5 Acknowledgment forms
  {
    title: 'Handbook',
    slug: 'handbook',
    type: 'ACKNOWLEDGMENT' as const,
    pdfUrl: null,
    sortOrder: 1,
  },
  {
    title: 'HIPAA',
    slug: 'hipaa',
    type: 'ACKNOWLEDGMENT' as const,
    pdfUrl: null,
    sortOrder: 2,
  },
  {
    title: 'Mandated Reporter',
    slug: 'mandated-reporter',
    type: 'ACKNOWLEDGMENT' as const,
    pdfUrl: null,
    sortOrder: 3,
  },
  {
    title: 'NDA',
    slug: 'nda',
    type: 'ACKNOWLEDGMENT' as const,
    pdfUrl: null,
    sortOrder: 4,
  },
  {
    title: 'Emergency Policy',
    slug: 'emergency-policy',
    type: 'ACKNOWLEDGMENT' as const,
    pdfUrl: null,
    sortOrder: 5,
  },
  // 4 Fillable PDF forms
  {
    title: 'Background Check Authorization',
    slug: 'background-check-authorization',
    type: 'FILLABLE_PDF' as const,
    pdfUrl: null,
    sortOrder: 6,
  },
  {
    title: 'I-9',
    slug: 'i9',
    type: 'FILLABLE_PDF' as const,
    pdfUrl: null,
    sortOrder: 7,
  },
  {
    title: 'W-4',
    slug: 'w4',
    type: 'FILLABLE_PDF' as const,
    pdfUrl: null,
    sortOrder: 8,
  },
  {
    title: 'Direct Deposit Authorization',
    slug: 'direct-deposit-authorization',
    type: 'FILLABLE_PDF' as const,
    pdfUrl: null,
    sortOrder: 9,
  },
]

async function seedOnboardingDocuments() {
  console.log('Seeding onboarding documents...')

  for (const doc of onboardingDocuments) {
    await prisma.onboardingDocument.upsert({
      where: { slug: doc.slug },
      update: {
        title: doc.title,
        type: doc.type,
        pdfUrl: doc.pdfUrl,
        sortOrder: doc.sortOrder,
        isActive: true,
      },
      create: doc,
    })
  }

  console.log(`✅ Seeded ${onboardingDocuments.length} onboarding documents`)
}

async function main() {
  await seedOnboardingDocuments()
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })

