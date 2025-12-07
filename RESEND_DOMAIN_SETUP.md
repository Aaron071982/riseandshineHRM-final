# Resend Domain Verification - Required for Sending to All Recipients

## Problem

You're seeing this error:
```
You can only send testing emails to your own email address (aaronsiam21@gmail.com). 
To send emails to other recipients, please verify a domain at resend.com/domains
```

## Why This Happens

When using Resend's free/test domain (`onboarding@resend.dev`), you can **only send emails to your own verified email address** (the one you signed up with). This is why:
- ✅ OTP emails work (you're logging in with your own email)
- ❌ Interview/reach-out emails fail (sending to other people's emails)

## Solution: Verify Your Domain

To send emails to **any recipient**, you need to verify a domain in Resend.

### Option 1: Verify Your Own Domain (Recommended)

1. **Go to Resend Dashboard**
   - Visit https://resend.com/domains
   - Click **"Add Domain"**

2. **Enter Your Domain**
   - Enter a domain you own (e.g., `riseandshinehrm.com`)
   - Click **"Add"**

3. **Add DNS Records**
   - Resend will provide DNS records (TXT records for SPF, DKIM, etc.)
   - Add these to your domain's DNS settings
   - Wait 5-10 minutes for verification

4. **Update Your .env File**
   ```env
   EMAIL_FROM=noreply@yourdomain.com
   # or
   EMAIL_FROM=onboarding@yourdomain.com
   ```

5. **Restart Your Server**
   ```bash
   npm run dev
   ```

### Option 2: Use a Subdomain

If you don't have a domain, you can:
- Purchase a domain ($10-15/year from Namecheap, Google Domains, etc.)
- Use a subdomain like `mail.riseandshinehrm.com`
- Verify it in Resend following the same steps

### Option 3: Quick Test Domain (Temporary)

For quick testing, you can use services like:
- **Mailtrap** (for testing only - emails don't actually send)
- **SendGrid** (has free tier with domain verification)
- **Amazon SES** (more complex setup)

## Quick Steps Summary

1. ✅ Get a domain (if you don't have one)
2. ✅ Go to https://resend.com/domains
3. ✅ Click "Add Domain" and enter your domain
4. ✅ Add DNS records to your domain provider
5. ✅ Wait for verification (5-10 minutes)
6. ✅ Update `.env` with: `EMAIL_FROM=noreply@yourdomain.com`
7. ✅ Restart server: `npm run dev`
8. ✅ Test sending an email to any recipient

## Current Status

- **RESEND_API_KEY**: ✅ Configured
- **EMAIL_FROM**: ⚠️ Using test domain (`onboarding@resend.dev`)
- **Domain Verified**: ❌ No domain verified
- **Can Send To**: Only `aaronsiam21@gmail.com` (your account email)

## After Domain Verification

Once you verify a domain, you'll be able to:
- ✅ Send emails to any recipient
- ✅ Use professional email addresses (e.g., `noreply@riseandshinehrm.com`)
- ✅ Better email deliverability
- ✅ No sending restrictions

## Need Help?

- Resend Domain Setup Guide: https://resend.com/docs/dashboard/domains/introduction
- Resend Support: support@resend.com

