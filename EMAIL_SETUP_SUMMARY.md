# Email Setup - Quick Summary

## The Issue

**Right now:** Resend only lets you send emails to YOUR email (`aaronsiam21@gmail.com`) because you're using a test domain.

**What you need:** To send emails to **any RBT** (interviews, hiring, firing), you need to verify your domain `riseandshinehrm.com` in Resend.

## Quick 5-Step Fix (10 minutes total)

### ✅ Step 1: Go to Resend
Visit: **https://resend.com/domains**
- Click **"Add Domain"**
- Enter: `riseandshinehrm.com`
- Click **"Add"**

### ✅ Step 2: Add DNS Records
Resend will give you DNS records to add. Go to your domain registrar and add them:
- **Where:** Your domain registrar's DNS settings (Namecheap, GoDaddy, etc.)
- **What:** Copy/paste the records Resend shows you
- **Wait:** 5-10 minutes for verification

### ✅ Step 3: Check Verification
- Go back to Resend dashboard → Domains
- Status should change from "Pending" → "Verified" ✅

### ✅ Step 4: Update .env File
Change this line in your `.env` file:
```env
EMAIL_FROM=noreply@riseandshinehrm.com
```

### ✅ Step 5: Restart Server
```bash
# Stop server (Ctrl+C) then:
npm run dev
```

## After Setup

You'll be able to:
- ✅ Send interview invites to any RBT email
- ✅ Send hiring offer emails
- ✅ Send rejection emails
- ✅ Send reach-out emails
- ✅ All emails from `noreply@riseandshinehrm.com`

## Test It

1. Go to Admin → RBTs & Candidates
2. Click "View" on any RBT
3. Click "Send Reach-Out Email"
4. Check their inbox!

---

**Full guide:** See `QUICK_EMAIL_SETUP.md` for detailed steps.

