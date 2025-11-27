# Complete Setup Guide: Authentication, Email & SMS

This guide will walk you through setting up **everything** so the HRM system works fully with real email and SMS capabilities.

---

## Part 1: Email Setup (Resend) - Required for Authentication & Notifications

### Step 1: Create Resend Account
1. Go to **https://resend.com**
2. Click "Start your project" or "Sign Up"
3. Sign up with your email (free tier includes 100 emails/day)
4. Verify your email address

### Step 2: Get Your API Key
1. Once logged in, go to **API Keys** in the left sidebar
2. Click **"Create API Key"**
3. Give it a name: `Rise and Shine HRM`
4. Click **"Add"**
5. **Copy the API key** (starts with `re_...`) - you'll only see it once!

### Step 3: Set Up Sender Domain (Choose One)

**Option A: Use Resend's Default Domain (Quickest)**
- No setup needed
- Use: `onboarding@resend.dev` as your sender email
- Note: Emails will show "via resend.com" in the sender field

**Option B: Verify Your Own Domain (Professional)**
1. In Resend dashboard → **Domains**
2. Click **"Add Domain"**
3. Enter your domain (e.g., `riseandshinehrm.com`)
4. Add the DNS records Resend provides to your domain's DNS
5. Wait for verification (usually 5-10 minutes)
6. Once verified, use any email from that domain (e.g., `noreply@riseandshinehrm.com`)

### Step 4: Update Your .env File

Open your `.env` file and update/add these lines:

```env
RESEND_API_KEY=re_your_actual_api_key_here
EMAIL_FROM=onboarding@resend.dev
```

**OR** if you verified your domain:
```env
RESEND_API_KEY=re_your_actual_api_key_here
EMAIL_FROM=noreply@yourdomain.com
```

### Step 5: Restart Your Server

After updating `.env`, restart your dev server:
1. Stop the current server (Ctrl+C in terminal)
2. Run: `npm run dev`
3. Test by sending a reach-out email from admin dashboard

---

## Part 2: SMS Setup (Twilio) - Required for OTP Login

### Step 1: Create Twilio Account
1. Go to **https://www.twilio.com**
2. Click "Sign up" (free trial with $15.50 credit)
3. Verify your email and phone number
4. Complete account setup

### Step 2: Get Your Credentials
1. In Twilio Console → **Account** → **API Keys & Tokens**
2. You'll see:
   - **Account SID**: Starts with `AC...` (always visible)
   - **Auth Token**: Click "View" to reveal (copy this!)

### Step 3: Get a Phone Number

**Option A: Use Trial Number (Free for Testing)**
1. In Twilio Console → **Phone Numbers** → **Manage** → **Buy a number**
2. Select a number (US numbers available)
3. Trial accounts can get one free number
4. Copy the phone number (format: `+1234567890`)

**Option B: Purchase a Number**
- Click "Buy a number"
- Choose your area code or search
- Complete purchase

### Step 4: Update Your .env File

Add these lines to your `.env`:

```env
TWILIO_ACCOUNT_SID=ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
TWILIO_AUTH_TOKEN=your_auth_token_here
TWILIO_PHONE_NUMBER=+1234567890
```

### Step 5: Restart Your Server

Restart your dev server to load the new credentials.

---

## Part 3: Complete .env File Template

Here's what your complete `.env` file should look like:

```env
# Database
DATABASE_URL="postgresql://aaron@localhost/riseandshinehrm"

# Auth
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=dev-secret-key-change-in-production

# Email (Resend)
RESEND_API_KEY=re_your_resend_api_key_here
EMAIL_FROM=onboarding@resend.dev

# SMS (Twilio)
TWILIO_ACCOUNT_SID=AC_your_twilio_account_sid
TWILIO_AUTH_TOKEN=your_twilio_auth_token
TWILIO_PHONE_NUMBER=+1234567890
```

---

## Part 4: Testing Your Setup

### Test Email Sending

1. **Log in as admin** with your email (`aaronsiam21@gmail.com`)
2. Go to **RBTs & Candidates**
3. Find the RBT profile you created (kaisar72@gmail.com)
4. Click **"View"**
5. Click **"Send Reach-Out Email"**
6. Check the email inbox for `kaisar72@gmail.com` - the email should arrive within seconds!

### Test OTP Authentication

1. **Log out** (click logout button)
2. Go to login page
3. Enter an email that exists in your database (e.g., `aaronsiam21@gmail.com`)
4. Click **"Send Verification Code"**
5. Check your email inbox for the OTP code
6. Enter the code and log in

### Test SMS (If Using Phone Authentication)

If you want to switch back to phone-based auth:
1. Ensure Twilio credentials are in `.env`
2. Restart server
3. Login with phone number
4. Check your phone for SMS with OTP code

---

## Part 5: Troubleshooting

### Email Not Sending?

**Check:**
1. ✅ Is `RESEND_API_KEY` in `.env`? (should start with `re_`)
2. ✅ Did you restart the server after adding the key?
3. ✅ Is the email address valid?
4. ✅ Check Resend dashboard → **Logs** for delivery status
5. ✅ Check spam folder

**Common Issues:**
- **"Invalid API key"**: Make sure you copied the full key including `re_` prefix
- **"Domain not verified"**: Use `onboarding@resend.dev` or verify your domain
- **Emails going to spam**: Add SPF/DKIM records from Resend to your domain

### SMS Not Sending?

**Check:**
1. ✅ Is `TWILIO_ACCOUNT_SID` in `.env`? (should start with `AC`)
2. ✅ Is `TWILIO_AUTH_TOKEN` correct?
3. ✅ Is `TWILIO_PHONE_NUMBER` in E.164 format (`+1234567890`)?
4. ✅ Trial accounts: Can only send to verified phone numbers initially
5. ✅ Check Twilio Console → **Monitor** → **Logs** → **Messaging**

**Common Issues:**
- **"Unauthorized"**: Check Account SID and Auth Token are correct
- **"Invalid phone number"**: Must be E.164 format (`+1` prefix)
- **"Trial account limitation"**: Verify the recipient phone number in Twilio Console first

### Database Issues?

**If you can't connect:**
```bash
# Check if PostgreSQL is running
ps aux | grep postgres

# If not running, start it:
brew services start postgresql@14

# Test connection
npm run db:push
```

---

## Part 6: Adding Users to Database

### Add Admin User

**Option 1: Through Prisma Studio (Easiest)**
```bash
npm run db:studio
```
Then:
1. Open `http://localhost:5555`
2. Click on `User` table
3. Click "Add record"
4. Fill in:
   - `phoneNumber`: (can be null)
   - `email`: `your@email.com`
   - `name`: Your Name
   - `role`: `ADMIN`
   - `isActive`: `true`
5. Save

**Option 2: Update Seed Script**
Edit `prisma/seed.ts` and add your admin, then:
```bash
npm run db:seed
```

### Add RBT Candidate (Through UI)
1. Log in as admin
2. Go to **RBTs & Candidates** → **Add New Candidate**
3. Fill out the form
4. Make sure to include an **email address** (required for emails to work)

---

## Part 7: Email Templates Explained

The system has 4 email templates:

1. **Reach-Out Email** (`REACH_OUT`)
   - Sent when admin clicks "Send Reach-Out Email"
   - Friendly introduction email

2. **Interview Invite** (`INTERVIEW_INVITE`)
   - Sent automatically when interview is scheduled
   - Includes date, time, meeting link

3. **Offer/Welcome Email** (`OFFER`)
   - Sent automatically when admin hires candidate
   - Welcome message + onboarding instructions

4. **Rejection Email** (`REJECTION`)
   - Polite rejection message
   - Can be sent manually

**All emails are logged** in the `interview_email_logs` table for audit purposes.

---

## Quick Start Checklist

- [ ] Create Resend account → Get API key → Add to `.env`
- [ ] Create Twilio account → Get credentials → Add to `.env`
- [ ] Restart server (`npm run dev`)
- [ ] Test email: Send reach-out email from admin dashboard
- [ ] Test OTP: Log in with email, receive OTP code
- [ ] Verify emails arrive in inbox (not spam)
- [ ] Add your admin user with email if not already added

---

## Current Status

**What's Working:**
- ✅ Database connection
- ✅ Email-based authentication (dev mode - codes in console)
- ✅ Admin dashboard
- ✅ RBT management
- ✅ All UI and workflows

**What Needs Setup:**
- ⚠️ **Resend API Key** - Add to `.env` for real emails
- ⚠️ **Twilio Credentials** - Add to `.env` if using SMS auth (currently using email auth)

**Current Mode:**
- Authentication: **Email-based OTP** (works in dev mode)
- Emails: **Logged to console** (needs Resend setup for real emails)

---

Once you add your Resend API key and restart the server, all emails will work immediately!

