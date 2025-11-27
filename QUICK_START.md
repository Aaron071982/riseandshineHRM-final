# Quick Start: Get Email Sending Working in 5 Minutes

## Current Issue
You're trying to send a reach-out email to `kaisar72@gmail.com` but it's not working because **Resend API key is not configured**.

## Solution: Add Your Resend API Key

### Step 1: Get Resend API Key (2 minutes)
1. Go to **https://resend.com/signup**
2. Sign up with your email (free tier = 100 emails/day)
3. After login → Go to **"API Keys"** (left sidebar)
4. Click **"Create API Key"**
5. Name it: `Rise and Shine HRM`
6. **Copy the key** (starts with `re_...`) ⚠️ You only see it once!

### Step 2: Add to .env File (1 minute)
1. Open your `.env` file in the project root
2. Find or add this line:
   ```env
   RESEND_API_KEY=re_your_actual_key_here
   ```
3. Also add (if not already there):
   ```env
   EMAIL_FROM=onboarding@resend.dev
   ```

### Step 3: Restart Server (30 seconds)
```bash
# Stop current server (Ctrl+C)
# Then restart:
npm run dev
```

### Step 4: Test It! (1 minute)
1. Go to http://localhost:3000
2. Log in with `aaronsiam21@gmail.com`
3. Go to **RBTs & Candidates**
4. Find the RBT with email `kaisar72@gmail.com`
5. Click **"View"**
6. Click **"Send Reach-Out Email"**
7. ✅ Email should be sent! Check `kaisar72@gmail.com` inbox

---

## For Email Authentication (OTP Login)

Same setup as above! Once you add `RESEND_API_KEY`:
- OTP codes will be sent via email (instead of just console)
- Check your email inbox for the 6-digit code
- Works for any user email in the database

---

## Troubleshooting

### Still not working?
1. **Check console** - Look for error messages when you click "Send Email"
2. **Check .env** - Make sure `RESEND_API_KEY` starts with `re_`
3. **Restart server** - After changing `.env`, you MUST restart
4. **Check Resend dashboard** - Go to resend.com → Logs to see delivery status

### Error: "Invalid API key"?
- Make sure you copied the full key including `re_` prefix
- No extra spaces before/after the key
- Restart server after adding key

### Email not arriving?
- Check spam folder
- Verify email address is correct in database
- Check Resend dashboard → Logs for delivery status
- If using `onboarding@resend.dev`, emails may go to spam initially

---

## Complete .env Template

Your `.env` should have at minimum:

```env
# Database (already configured)
DATABASE_URL="postgresql://aaron@localhost/riseandshinehrm"

# Email (ADD THIS!)
RESEND_API_KEY=re_your_key_here
EMAIL_FROM=onboarding@resend.dev

# Optional: For production
NODE_ENV=development
```

---

## Need More Help?

See `COMPLETE_SETUP_GUIDE.md` for:
- Detailed Resend setup
- Twilio SMS setup (if needed)
- Domain verification
- Production deployment tips

