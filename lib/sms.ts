import twilio from 'twilio'

const accountSid = process.env.TWILIO_ACCOUNT_SID
const authToken = process.env.TWILIO_AUTH_TOKEN
const twilioPhoneNumber = process.env.TWILIO_PHONE_NUMBER

let twilioClient: twilio.Twilio | null = null

if (accountSid && authToken) {
  twilioClient = twilio(accountSid, authToken)
}

export async function sendOTPSMS(phoneNumber: string, code: string): Promise<boolean> {
  // Format phone number to E.164 format
  const formattedPhone = formatPhoneNumber(phoneNumber)

  // In development or if Twilio is not configured, just log the OTP
  if (!twilioClient || !twilioPhoneNumber) {
    console.log(`[DEV MODE] OTP for ${formattedPhone}: ${code}`)
    return true
  }

  try {
    await twilioClient.messages.create({
      body: `Your Rise and Shine HRM verification code is: ${code}. This code will expire in 5 minutes.`,
      from: twilioPhoneNumber,
      to: formattedPhone,
    })
    return true
  } catch (error) {
    console.error('Error sending SMS:', error)
    return false
  }
}

export function formatPhoneNumber(phone: string): string {
  // Remove all non-digits
  const digits = phone.replace(/\D/g, '')

  // If it starts with 1 and has 11 digits, or has 10 digits, format it
  if (digits.length === 11 && digits.startsWith('1')) {
    return `+${digits}`
  } else if (digits.length === 10) {
    return `+1${digits}`
  }

  // If already formatted with +, return as is
  if (phone.startsWith('+')) {
    return phone
  }

  return `+1${digits}`
}

