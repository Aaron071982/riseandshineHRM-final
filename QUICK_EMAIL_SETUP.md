# Quick Email Setup Guide - riseandshinehrm.com

## The Problem
Currently, Resend only allows sending emails to your verified account email (`aaronsiam21@gmail.com`) because you're using the test domain. To send emails to **any RBT** (for interviews, hiring, firing), you need to verify your domain.

## Solution: Verify Your Domain in Resend (10 minutes)

### Step 1: Add Domain to Resend (2 minutes)
1. Go to **https://resend.com/domains**
2. Click **"Add Domain"** button
3. Enter: `riseandshinehrm.com`
4. Click **"Add"**

### Step 2: Add DNS Records (5 minutes)
Resend will show you DNS records like:
- **TXT record** for SPF
- **TXT record** for DKIM
- **CNAME record** for domain verification

**Where to add these:**
- Go to your domain registrar (where you bought `riseandshinehrm.com`)
- Look for "DNS Settings" or "DNS Management"
- Add each record Resend provides
- Save changes

**Common Domain Registrars:**
- **Namecheap**: Domain List → Manage → Advanced DNS
- **GoDaddy**: DNS Management
- **Google Domains**: DNS → Custom Records
- **Cloudflare**: DNS → Records

### Step 3: Wait for Verification (2-10 minutes)
- Resend will automatically check DNS records
- Status will change from "Pending" to "Verified"
- Usually takes 5-10 minutes

### Step 4: Update Your .env File (1 minute)
Once verified, update your `.env` file:

```env
RESEND_API_KEY=re_your_api_key_here
EMAIL_FROM=noreply@riseandshinehrm.com
```

**Or use:**
- `onboarding@riseandshinehrm.com`
- `hrm@riseandshinehrm.com`
- `noreply@riseandshinehrm.com`

### Step 5: Restart Your Server (30 seconds)
```bash
# Stop the current server (Ctrl+C)
# Then restart:
npm run dev
```

## What This Enables

Once your domain is verified, you can:
✅ Send interview invite emails to **any RBT email**
✅ Send reach-out emails to candidates
✅ Send offer emails when hiring
✅ Send rejection emails
✅ Send onboarding package notifications
✅ All emails will come from `noreply@riseandshinehrm.com` (professional!)

## Testing After Setup

1. Go to Admin Dashboard → RBTs & Candidates
2. Find an RBT candidate
3. Click "Send Reach-Out Email"
4. Check the RBT's inbox - email should arrive!

## Troubleshooting

### Domain Not Verifying?
- **Check DNS records**: Make sure you copied them exactly from Resend
- **Wait longer**: Sometimes takes up to 24 hours (usually 5-10 min)
- **Check DNS propagation**: Use https://dnschecker.org to see if records are live

### Still Getting Errors?
- Make sure `EMAIL_FROM` in `.env` matches your verified domain
- Restart your server after changing `.env`
- Check Resend dashboard → Logs to see delivery status

## Quick Checklist

- [ ] Added domain to Resend dashboard
- [ ] Added DNS records to domain registrar
- [ ] Waited for domain verification (check Resend dashboard)
- [ ] Updated `.env` with `EMAIL_FROM=noreply@riseandshinehrm.com`
- [ ] Restarted server (`npm run dev`)
- [ ] Tested sending an email to an RBT

## Current Status

✅ **Domain**: `riseandshinehrm.com` (you have this!)
✅ **Resend API Key**: Should be configured
❌ **Domain Verified**: Need to complete above steps
❌ **EMAIL_FROM**: Currently using test domain (needs update)

---

**Once complete, all your HRM emails (interviews, hiring, onboarding) will work perfectly!**

