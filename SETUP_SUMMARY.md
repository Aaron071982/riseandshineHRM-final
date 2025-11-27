# Complete Setup Summary: Everything You Need to Know

## 🎯 Current Status

### ✅ What's Working
- ✅ Database (PostgreSQL) - Connected and working
- ✅ Authentication system - Email-based OTP login
- ✅ Admin dashboard - Full functionality
- ✅ RBT management - Create, view, update candidates
- ✅ UI/UX - Complete and styled
- ✅ All API routes - Backend logic complete

### ⚠️ What Needs Setup
- ⚠️ **Email sending** - `RESEND_API_KEY` is empty in `.env`
- ⚠️ **Email OTP** - Currently shows code in console (dev mode)

---

## 🔧 Problem: Why Emails Aren't Sending

Your `.env` file currently has:
```env
RESEND_API_KEY=          ← EMPTY! This is why emails don't work
EMAIL_FROM=noreply@riseandshinehrm.com
```

When `RESEND_API_KEY` is empty:
- ❌ Real emails won't send
- ✅ Emails are logged to console (dev mode)
- ✅ Database records are created (emails logged in `interview_email_logs` table)

---

## 🚀 Quick Fix: Add Resend API Key

### Step 1: Get API Key (2 minutes)
1. Go to **https://resend.com/signup**
2. Sign up (free - 100 emails/day)
3. Dashboard → **API Keys** → **Create API Key**
4. Copy the key (starts with `re_...`)

### Step 2: Update `.env`
```env
RESEND_API_KEY=re_your_actual_key_here
EMAIL_FROM=onboarding@resend.dev
```

**Note:** Change `EMAIL_FROM` to `onboarding@resend.dev` initially (it's pre-verified). Later you can verify your own domain.

### Step 3: Restart Server
```bash
# Stop current server (Ctrl+C)
npm run dev
```

### Step 4: Test
1. Log in as admin
2. Go to RBT profile (`kaisar72@gmail.com`)
3. Click **"Send Reach-Out Email"**
4. ✅ Email should arrive in inbox!

---

## 📧 How Email System Works

### Email Flow
1. **Admin clicks "Send Reach-Out Email"** → Frontend sends POST to `/api/admin/rbts/[id]/send-email`
2. **API route** → Validates admin, fetches RBT profile, generates email content
3. **`lib/email.ts`** → Logs email to database, then sends via Resend
4. **Resend API** → Delivers email to recipient
5. **Email log** → Stored in `interview_email_logs` table for audit trail

### Email Templates
- **REACH_OUT** - Initial contact email
- **INTERVIEW_INVITE** - Interview scheduling (sent automatically)
- **OFFER** - Welcome email when hiring (sent automatically)
- **REJECTION** - Polite rejection (can be sent manually)

### Email Logging
Every email is logged in the database:
- ✅ Who received it (`toEmail`)
- ✅ What template (`templateType`)
- ✅ When sent (`sentAt`)
- ✅ Full content (`body`)
- ✅ Delivery status (`status`)

---

## 🔐 How Authentication Works

### Current Setup: Email-Based OTP

1. **User enters email** on login page
2. **Backend generates 6-digit OTP** code
3. **OTP stored in database** (`otp_codes` table) with 5-minute expiry
4. **Email sent** with OTP code (or logged to console in dev mode)
5. **User enters OTP** on verify page
6. **Backend validates OTP** (checks expiry, not used)
7. **Session created** (HTTP-only cookie set)
8. **User redirected** to dashboard (admin or RBT)

### OTP Code Storage
```sql
otp_codes table:
- email (unique per code)
- code (6 digits)
- expiresAt (5 minutes from creation)
- used (false until verified)
```

### Session Management
- Sessions stored in `sessions` table
- Token stored in HTTP-only cookie (`session`)
- Token expires after 7 days
- Validated on every protected route access

### Role-Based Access
- **ADMIN** → Can access `/admin/*` routes
- **RBT** → Can access `/rbt/*` routes
- **CANDIDATE** → Limited access (before being hired)

---

## 📊 Database Schema Overview

### Key Tables

**`users`**
- Stores all users (admin, RBT, candidate)
- Links to `rbt_profiles` via `userId`
- Email field used for login

**`rbt_profiles`**
- Stores RBT/candidate information
- Status: NEW → REACH_OUT → TO_INTERVIEW → INTERVIEW_SCHEDULED → HIRED
- Email stored here (used for sending emails)

**`otp_codes`**
- Stores OTP codes for authentication
- Automatically cleaned up after expiry
- Email-based (phoneNumber optional/legacy)

**`sessions`**
- Active user sessions
- Linked to user via `userId`
- Token used for authentication

**`interview_email_logs`**
- Audit trail of all emails sent
- Stores full email content
- Tracks delivery status

---

## 🔄 Complete User Flow

### Admin Flow
1. **Login** → Email + OTP code
2. **Dashboard** → Overview of RBTs, interviews, onboarding
3. **Add Candidate** → Create new RBT profile
4. **Send Reach-Out** → Email candidate
5. **Schedule Interview** → Create interview, send invite email
6. **Hire Candidate** → Change status to HIRED, create onboarding tasks, send welcome email
7. **Manage Onboarding** → Track progress
8. **Approve Leave** → Review leave requests

### RBT Flow
1. **Login** → Email + OTP code (if already hired)
2. **Onboarding Dashboard** → Complete tasks (if not finished)
3. **Main Dashboard** → View schedule, hours, attendance (after onboarding)
4. **Schedule** → View upcoming shifts
5. **Hours** → Log time entries
6. **Leave** → Request time off
7. **Documents** → Download/upload forms

---

## 🔧 Configuration Checklist

### Required for Email Sending
- [ ] Create Resend account
- [ ] Get API key
- [ ] Add to `.env`: `RESEND_API_KEY=re_...`
- [ ] Set `EMAIL_FROM=onboarding@resend.dev` (or your verified domain)
- [ ] Restart server

### Required for SMS (if switching back to phone auth)
- [ ] Create Twilio account
- [ ] Get Account SID and Auth Token
- [ ] Get phone number
- [ ] Add to `.env`: `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_PHONE_NUMBER`
- [ ] Restart server

### Required for Production
- [ ] Set `NODE_ENV=production`
- [ ] Use real database (not localhost)
- [ ] Set secure `NEXTAUTH_SECRET`
- [ ] Verify your domain in Resend
- [ ] Update `EMAIL_FROM` to your domain email
- [ ] Set up SSL/TLS certificates

---

## 🐛 Troubleshooting

### "Email sent" but not arriving?
1. **Check spam folder**
2. **Check Resend dashboard** → Logs (shows delivery status)
3. **Verify email address** is correct in database
4. **Check console** for errors

### OTP not working?
1. **Check console** - OTP code should be logged in dev mode
2. **Check expiry** - OTPs expire after 5 minutes
3. **Verify email** exists in database
4. **Check database** - `otp_codes` table should have entries

### Database errors?
1. **Check PostgreSQL is running**: `ps aux | grep postgres`
2. **Check DATABASE_URL** in `.env` is correct
3. **Restart server** after database changes
4. **Run migrations**: `npm run db:push`

---

## 📝 File Structure

### Key Files for Email/Auth

```
lib/
  ├── email.ts           # Email sending (Resend integration)
  ├── email-otp.ts       # OTP email sending
  ├── auth.ts            # Session management
  └── otp.ts             # OTP generation

app/api/
  ├── auth/
  │   ├── send-otp/      # Send OTP to email
  │   ├── verify-otp/    # Verify OTP code
  │   └── logout/        # End session
  └── admin/rbts/[id]/
      └── send-email/    # Send email templates

components/
  └── auth/
      └── LoginPage.tsx  # Login form
```

---

## 🎓 Understanding the Codebase

### Email Sending (`lib/email.ts`)
```typescript
sendEmail(options) {
  1. Log email to database (interview_email_logs)
  2. If no RESEND_API_KEY → log to console (dev mode)
  3. If RESEND_API_KEY exists → send via Resend API
  4. Return true/false based on success
}
```

### OTP Authentication (`lib/email-otp.ts`)
```typescript
sendOTPEmail(email, code) {
  1. Generate HTML email template
  2. If no RESEND_API_KEY → log code to console
  3. If RESEND_API_KEY exists → send via Resend
  4. Return true/false
}

storeOTPEmail(email, code) {
  1. Clean up old OTPs for this email
  2. Store new OTP with 5-minute expiry
}

verifyOTPEmail(email, code) {
  1. Find OTP in database
  2. Check not expired
  3. Check not already used
  4. Mark as used
  5. Return true/false
}
```

### Session Management (`lib/auth.ts`)
```typescript
createSession(userId) {
  1. Generate random token
  2. Store in sessions table
  3. Set expiry (7 days)
  4. Return token
}

validateSession(token) {
  1. Find session in database
  2. Check not expired
  3. Fetch user info
  4. Return user or null
}
```

---

## 🚀 Next Steps

1. **Add Resend API Key** → See `QUICK_START.md`
2. **Test email sending** → Send reach-out email
3. **Test OTP login** → Should receive real email codes
4. **Add more RBTs** → Create candidates through UI
5. **Test full flow** → Reach out → Interview → Hire → Onboarding

---

## 📚 Documentation Files

- **`QUICK_START.md`** - 5-minute setup guide
- **`COMPLETE_SETUP_GUIDE.md`** - Comprehensive setup with screenshots
- **`SETUP.md`** - Original setup instructions
- **`DATABASE_SETUP.md`** - PostgreSQL setup guide
- **`README.md`** - Project overview

---

## 💡 Pro Tips

1. **Use Resend dashboard** → Monitor email delivery in real-time
2. **Check logs** → All emails logged in `interview_email_logs` table
3. **Dev mode** → OTP codes always shown on verify page
4. **Email templates** → Customize in `lib/email.ts`
5. **Domain verification** → Improves deliverability (fewer spam issues)

---

**That's everything! Once you add the Resend API key, everything will work end-to-end.** 🎉

