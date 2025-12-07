# Quick Email Status Check

## If Email Shows "Delivered" But Not Received

### Step 1: Check Spam/Junk Folder
✅ Most common reason! Ask the recipient to check their spam/junk folder.

### Step 2: Check Resend Dashboard
1. Go to https://resend.com/logs
2. Look for the email you sent
3. Check delivery status:
   - ✅ **Delivered** → Email was sent, check spam folder
   - ⚠️ **Bounced** → Email address invalid
   - ❌ **Failed** → Check error message

### Step 3: Verify Domain is Fully Verified
1. Go to https://resend.com/domains
2. Click on `riseandshinehrm.com`
3. Check:
   - ✅ Status: "Verified"
   - ✅ All DNS records: "Verified"
   - ✅ Enable Sending toggle: ON

### Step 4: Check Server Logs
When you sent the email, check your terminal/console for:
- Error messages
- "Email sent successfully" message
- Any warnings

## Common Issues

### Issue: Domain Not Fully Verified
**Symptom**: Emails fail or bounce
**Fix**: Complete domain verification in Resend dashboard

### Issue: Server Not Restarted
**Symptom**: Still using old EMAIL_FROM address
**Fix**: Restart server after updating .env

### Issue: Email in Spam
**Symptom**: Shows "delivered" but not in inbox
**Fix**: Ask recipient to check spam and mark as "Not Spam"

### Issue: Invalid Email Address
**Symptom**: Email bounces or fails
**Fix**: Verify email address is correct

## Quick Test

Send an email to YOUR OWN email address first:
1. Create a test RBT with your email
2. Send reach-out email
3. Check your inbox (and spam)
4. If you receive it → Domain is working!
5. If not → Check Resend logs for errors

