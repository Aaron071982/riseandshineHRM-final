import { prisma } from './prisma'

const OTP_EXPIRY_MINUTES = 5
const OTP_LENGTH = 6

export function generateOTP(): string {
  return Math.floor(100000 + Math.random() * 900000).toString()
}

export async function storeOTP(phoneNumber: string, code: string): Promise<void> {
  const expiresAt = new Date(Date.now() + OTP_EXPIRY_MINUTES * 60 * 1000)

  // Clean up old OTPs for this phone number
  await prisma.otpCode.deleteMany({
    where: {
      phoneNumber,
      OR: [
        { used: true },
        { expiresAt: { lt: new Date() } },
      ],
    },
  })

  await prisma.otpCode.create({
    data: {
      phoneNumber,
      code,
      expiresAt,
    },
  })
}

export async function verifyOTP(phoneNumber: string, code: string): Promise<boolean> {
  const otp = await prisma.otpCode.findFirst({
    where: {
      phoneNumber,
      code,
      used: false,
      expiresAt: {
        gt: new Date(),
      },
    },
  })

  if (!otp) {
    return false
  }

  // Mark as used
  await prisma.otpCode.update({
    where: { id: otp.id },
    data: { used: true },
  })

  return true
}

export async function cleanupExpiredOTPs(): Promise<void> {
  await prisma.otpCode.deleteMany({
    where: {
      OR: [
        { used: true },
        { expiresAt: { lt: new Date() } },
      ],
    },
  })
}

