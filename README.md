# Rise and Shine HRM

A production-ready web-based Human Resource Management (HRM) system for a small ABA company called "Rise and Shine".

## Features

- **Phone-based SMS OTP Authentication**: Secure login using phone numbers with one-time passcodes
- **Admin Dashboard**: Comprehensive overview of candidates, interviews, onboarding, and RBT management
- **RBT Hiring Pipeline**: Track candidates from initial contact through hiring
- **Interview Management**: Schedule interviews, send invites, and track decisions
- **Onboarding System**: HIPAA compliance documentation and training video tracking
- **RBT Portal**: Schedule viewing, hours tracking, and leave request management
- **Responsive Design**: Mobile and desktop friendly with a clean, modern UI

## Tech Stack

- **Framework**: Next.js 14 (App Router)
- **Language**: TypeScript
- **Database**: PostgreSQL with Prisma ORM
- **Styling**: Tailwind CSS with custom orange/white theme
- **Authentication**: Custom session-based auth with SMS OTP
- **Email**: Resend (configurable)
- **SMS**: Twilio (configurable)

## Getting Started

### Prerequisites

- Node.js 18+ and npm/yarn
- PostgreSQL database
- Twilio account (for SMS OTP)
- Resend account (for email)

### Installation

1. Clone the repository and install dependencies:

```bash
npm install
```

2. Set up your environment variables:

Copy `.env.example` to `.env` and fill in your values:

```bash
DATABASE_URL="postgresql://user:password@localhost:5432/riseandshinehrm?schema=public"
NEXTAUTH_SECRET=your-secret-key-here
TWILIO_ACCOUNT_SID=your-twilio-account-sid
TWILIO_AUTH_TOKEN=your-twilio-auth-token
TWILIO_PHONE_NUMBER=your-twilio-phone-number
RESEND_API_KEY=your-resend-api-key
EMAIL_FROM=noreply@riseandshinehrm.com
```

3. Set up the database:

```bash
# Generate Prisma client
npm run db:generate

# Push schema to database
npm run db:push

# Seed the database with admin users and sample data
npm run db:seed
```

4. Run the development server:

```bash
npm run dev
```

5. Open [http://localhost:3000](http://localhost:3000) in your browser.

## Default Admin Users

After seeding, you can log in with these phone numbers:

- **Aaron**: 3473090431
- **Kazi**: 5551234567
- **Tisha**: 5559876543

In development mode, OTP codes will be logged to the console instead of being sent via SMS.

## Project Structure

```
├── app/                    # Next.js app directory
│   ├── admin/             # Admin pages and routes
│   ├── api/               # API routes
│   ├── rbt/               # RBT portal pages
│   └── page.tsx           # Login page
├── components/            # React components
│   ├── admin/            # Admin-specific components
│   ├── auth/             # Authentication components
│   ├── layout/           # Layout components
│   ├── rbt/              # RBT-specific components
│   └── ui/               # Reusable UI components
├── lib/                  # Utility functions
│   ├── auth.ts           # Authentication helpers
│   ├── email.ts          # Email templates and sending
│   ├── otp.ts            # OTP generation and verification
│   ├── prisma.ts         # Prisma client
│   └── sms.ts            # SMS sending
├── prisma/               # Prisma schema and migrations
│   ├── schema.prisma     # Database schema
│   └── seed.ts           # Database seed script
└── public/               # Static assets
```

## Key Features in Detail

### Authentication Flow

1. User enters phone number
2. System generates 6-digit OTP and sends via SMS
3. User enters OTP to verify
4. System creates session and redirects based on role:
   - **ADMIN** → Admin Dashboard
   - **RBT** → RBT Dashboard (or Onboarding if incomplete)

### Admin Features

- **RBT/Candidate Management**: Add, view, edit candidates through the hiring pipeline
- **Interview Scheduling**: Schedule interviews with calendar integration placeholders
- **Status Management**: Move candidates through pipeline stages (NEW → REACH_OUT → TO_INTERVIEW → HIRED)
- **Onboarding Tracking**: Monitor RBT onboarding progress
- **Leave Request Management**: Approve or deny leave requests

### RBT Features

- **Onboarding Dashboard**: Complete HIPAA docs and training videos before accessing full portal
- **Schedule Viewing**: See upcoming shifts and client assignments
- **Hours Tracking**: View time entries and hours worked
- **Leave Requests**: Submit and track time-off requests

## Deployment

This application is designed to be deployed on Vercel with a Supabase PostgreSQL database. Make sure to:

1. Set all environment variables in your deployment platform
2. Run database migrations: `npm run db:push`
3. Seed the database: `npm run db:seed`

## Development Notes

- In development, SMS OTP codes are logged to the console
- Email templates are ready for Resend integration
- Google Meet links are placeholder URLs (ready for integration)
- File uploads for onboarding docs store placeholder paths (ready for S3/Cloudinary integration)

## License

Private - Rise and Shine HRM

