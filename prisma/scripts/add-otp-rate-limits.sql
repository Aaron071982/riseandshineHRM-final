-- OTP rate limiting (DB-backed for Vercel serverless) + per-code attempt tracking
-- Run in Supabase SQL editor before deploying auth hardening.

ALTER TABLE otp_codes
  ADD COLUMN IF NOT EXISTS "failedAttempts" INTEGER NOT NULL DEFAULT 0;

CREATE TABLE IF NOT EXISTS otp_rate_limits (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  key TEXT NOT NULL,
  "windowStart" TIMESTAMPTZ NOT NULL,
  count INTEGER NOT NULL DEFAULT 1,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (key, "windowStart")
);

CREATE INDEX IF NOT EXISTS otp_rate_limits_key_window_idx
  ON otp_rate_limits (key, "windowStart");
