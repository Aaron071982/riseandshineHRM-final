# Hiring RBT Issue - Fixed! ✅

## The Problem

When you hired a new RBT, they couldn't see onboarding tasks because:

1. **User Role Not Updated**: The User record still had `role: 'CANDIDATE'` instead of `role: 'RBT'`
2. **User Not Active**: The User record had `isActive: false` instead of `true`
3. **Email Mismatch**: Sometimes User.email didn't match RBTProfile.email

## The Solution

### ✅ Fixed Existing Hired RBTs

All existing hired RBTs have been fixed. They now have:
- ✅ User role = `RBT`
- ✅ User isActive = `true`
- ✅ User email matches RBTProfile email
- ✅ All 6 onboarding tasks created

### ✅ Improved Hire Route

The hire route (`/api/admin/rbts/[id]/hire`) now:
- ✅ Has better error handling
- ✅ Always ensures user role is updated to RBT
- ✅ Always ensures user is active
- ✅ Always creates onboarding tasks if they don't exist

### ✅ Auto-Fix in Login

The login flow (`/api/auth/verify-otp`) now automatically fixes:
- ✅ CANDIDATE users who are HIRED → automatically updates to RBT
- ✅ Email mismatches → automatically syncs emails

## For Future Hires

When you hire a new RBT, the system will now:

1. ✅ Update their User record to `role: RBT` and `isActive: true`
2. ✅ Create all 6 onboarding tasks automatically
3. ✅ Send welcome email with login instructions
4. ✅ They can immediately log in and see onboarding tasks

## If Issues Occur

If a newly hired RBT still doesn't see onboarding tasks:

### Quick Fix Script

Run this command to fix all hired RBTs:
```bash
npm run fix:hired-rbts
```

This will:
- Fix all user records (role, isActive, email)
- Ensure all 6 onboarding tasks exist for each hired RBT
- Fix any inconsistencies

### Manual Check

1. Go to Admin Dashboard → RBTs & Candidates
2. Find the hired RBT
3. Click "View"
4. Check "Onboarding Progress" section - should show 6 tasks

### What to Check

- ✅ RBT Profile status = `HIRED`
- ✅ User role = `RBT` (not `CANDIDATE`)
- ✅ User isActive = `true`
- ✅ Onboarding tasks count = 6

## Summary

**Before:** Hired RBTs couldn't log in or see onboarding tasks because user records weren't properly updated.

**After:** 
- ✅ All hired RBTs are fixed
- ✅ Hire route is more robust
- ✅ Login flow auto-fixes issues
- ✅ Fix script available for future issues

**All hired RBTs should now be able to log in and see their onboarding tasks!** 🎉

