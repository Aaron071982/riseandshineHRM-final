-- Seed / upsert test user for Operations portal (login via OTP at /login)
INSERT INTO users (id, email, name, role, "isActive", "phoneNumber", "createdAt", "updatedAt")
VALUES (
  'ops-test-aaronsiam25',
  'aaronsiam25@gmail.com',
  'Operations Test User',
  'ADMIN',
  true,
  NULL,
  NOW(),
  NOW()
)
ON CONFLICT (email) DO UPDATE SET
  "isActive" = true,
  name = EXCLUDED.name,
  "updatedAt" = NOW();
