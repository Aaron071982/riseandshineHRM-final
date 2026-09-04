-- Referring / primary care provider who referred for ABA (client overview → assessment).
ALTER TABLE service_clients
  ADD COLUMN IF NOT EXISTS "referringProvider" TEXT;
