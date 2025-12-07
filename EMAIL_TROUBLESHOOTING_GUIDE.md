# Email Not Sending? Troubleshooting Guide

## Quick Checklist

✅ **Domain Verified**: `riseandshinehrm.com` is verified on Resend
✅ **API Key**: RESEND_API_KEY is set in .env
✅ **EMAIL_FROM**: Set to `noreply@riseandshinehrm.com`

## Common Issues & Fixes

### Issue 1: Server Not Restarted After .env Change

**Problem**: You updated EMAIL_FROM but server is still using old value.

**Fix**: Restart the server
```bash
# Stop server (Ctrl+C)
npm run dev
```

### Issue 2: Domain Not Fully Verified

**Check**: Go to https://resend.com/domains
- Status should be "Verified" ✅ (green)
- All DNS records should show "Verified" ✅

**If not verified:**
1. Check DNS records in your domain registrar
2. Wait 5-10 minutes for DNS propagation
3. Refresh Resend dashboard

### Issue 3: Email Going to Spam

**Check**: Ask recipient to check spam/junk folder

**Fix**: 
- Emails from verified domains usually go to inbox
- If in spam, mark as "Not Spam" to help deliverability

### Issue 4: Wrong EMAIL_FROM Address

**Current Setting**: `EMAIL_FROM=noreply@riseandshinehrm.com`

**Verify**: 
- This must match the verified domain exactly
- Cannot use subdomain unless verified separately
- Format: `anything@riseandshinehrm.com`

### Issue 5: Resend API Errors

**Check Server Logs**: Look for error messages when sending email

**Common Errors:**
- `403 Forbidden` → Domain not verified or wrong EMAIL_FROM
- `400 Bad Request` → Invalid email address or format
- `429 Too Many Requests` → Rate limit (free tier = 100 emails/day)

## Testing Email Sending

### Step 1: Check Email Logs

The system logs all emails in the database. Check recent emails:

```bash
npm run db:studio
```

Then check the `interview_email_logs` table to see:
- Email status (sent, delivered, failed)
- Error messages (if any)
- Timestamp

### Step 2: Check Server Console

When you send an email, check your terminal/console for:
- ✅ "Email sent successfully" → Working!
- ❌ "Error sending email" → Check error message
- ⚠️ "Resend not configured" → RESEND_API_KEY not set

### Step 3: Check Resend Dashboard

1. Go to https://resend.com/logs
2. See all email attempts
3. Check delivery status
4. See error messages if failed

## After Domain Verification

**Important Steps:**

1. ✅ Update `.env`:
   ```env
   EMAIL_FROM=noreply@riseandshinehrm.com
   ```

2. ✅ Restart server:
   ```bash
   npm run dev
   ```

3. ✅ Test sending:
   - Send a reach-out email
   - Check server console for errors
   - Check Resend dashboard logs
   - Check recipient's inbox (and spam)

## Still Not Working?

1. **Check Resend Logs**: https://resend.com/logs
   - See actual error messages
   - Check delivery status

2. **Check Server Console**: 
   - Look for error messages when sending
   - Copy any error text

3. **Verify Domain Status**: https://resend.com/domains
   - Should show "Verified" ✅
   - All DNS records verified ✅

4. **Test with Simple Email**:
   - Send to your own email first
   - If that works, domain is fine
   - If not, check domain verification

## Current Configuration

- **Domain**: `riseandshinehrm.com`
- **EMAIL_FROM**: `noreply@riseandshinehrm.com`
- **API Key**: Set (starts with `re_...`)

**Next Step**: Restart server to apply changes! 🔄

