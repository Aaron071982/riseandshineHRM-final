# Email Troubleshooting Guide

## Problem: Emails Not Sending

If emails aren't being sent, follow these steps:

### 1. Check if RESEND_API_KEY is Configured

Your `.env` file should have:
```env
RESEND_API_KEY=re_your_actual_key_here
EMAIL_FROM=onboarding@resend.dev
```

### 2. **RESTART THE SERVER** (Critical!)

After adding or changing `RESEND_API_KEY`, you MUST restart the dev server:

```bash
# Stop the current server (Ctrl+C in terminal)
npm run dev
```

Environment variables are only loaded when the server starts!

### 3. Check Server Console Logs

When you try to send an email, check the terminal where `npm run dev` is running. You should see:

**If working correctly:**
```
📧 Attempting to send email to example@email.com via Resend...
✅ Email sent successfully to example@email.com: { id: '...' }
```

**If Resend not configured:**
```
⚠️ [DEV MODE] Resend not configured. Email would be sent to...
RESEND_API_KEY is: NOT SET
Email logged to database but NOT sent.
```

**If there's an error:**
```
❌ Error sending email via Resend: [error details]
```

### 4. Check Resend API Key

1. Go to https://resend.com
2. Log in to your account
3. Go to **API Keys** in the sidebar
4. Verify your API key is active
5. Make sure you copied the FULL key (starts with `re_`)

### 5. Verify Email Address

Make sure the RBT profile has a valid email address:
- Check the email format is correct
- Check there are no extra spaces
- Verify the email exists

### 6. Check Resend Dashboard

1. Go to https://resend.com/dashboard
2. Click on **Logs** in the sidebar
3. Check if emails are being sent
4. Look for any error messages or delivery failures

### 7. Common Issues

**Issue: "Email logged but not sent"**
- ✅ RESEND_API_KEY is missing or empty
- ✅ Server wasn't restarted after adding key
- Solution: Add key to `.env` and restart server

**Issue: "Invalid API key"**
- ❌ API key is incorrect or expired
- Solution: Create a new API key in Resend dashboard

**Issue: "Email sent but not received"**
- Check spam/junk folder
- Verify email address is correct
- Check Resend dashboard logs for delivery status
- Using `onboarding@resend.dev` may go to spam initially

**Issue: "Domain not verified"**
- You're using a custom domain that isn't verified
- Solution: Use `onboarding@resend.dev` (pre-verified) or verify your domain

### 8. Test Email Sending

Try sending a reach-out email from the admin dashboard:
1. Go to RBTs & Candidates
2. Click on an RBT profile
3. Click "Send Reach-Out Email"
4. Check the browser console (F12) for any errors
5. Check the server terminal for logs

### 9. Database Email Logs

All emails are logged in the database. Check the `interview_email_logs` table:
- See what emails were attempted
- Check the status field
- View the email content

### 10. Need More Help?

Check the server terminal output for detailed error messages. The improved error handling will show:
- Whether Resend is configured
- Detailed error messages from Resend API
- Email addresses being sent to
- Success/failure status

