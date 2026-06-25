-- Billing portal login: ensure Rafique + Afrin can sign in (role BILLING on `users`).
-- Run in Supabase SQL Editor. Safe to re-run.

UPDATE users
SET role = 'BILLING', "isActive" = true, "updatedAt" = NOW()
WHERE email ILIKE 'rafique@riseandshineaba.com';

UPDATE users
SET role = 'BILLING', "isActive" = true, "updatedAt" = NOW()
WHERE email ILIKE 'afrin@riseandshineaba.com';

INSERT INTO users (id, email, name, role, "isActive", "createdAt", "updatedAt")
SELECT
  'cmqlbillingrafique001',
  'rafique@riseandshineaba.com',
  'Rafique',
  'BILLING',
  true,
  NOW(),
  NOW()
WHERE NOT EXISTS (SELECT 1 FROM users WHERE email ILIKE 'rafique@riseandshineaba.com');

INSERT INTO users (id, email, name, role, "isActive", "createdAt", "updatedAt")
SELECT
  'cmqlbillingafrin001',
  'afrin@riseandshineaba.com',
  'Afrin',
  'BILLING',
  true,
  NOW(),
  NOW()
WHERE NOT EXISTS (SELECT 1 FROM users WHERE email ILIKE 'afrin@riseandshineaba.com');

UPDATE users
SET role = 'BILLING', "isActive" = true, "updatedAt" = NOW()
WHERE email ILIKE 'jaden.j.brown2025@gmail.com';

INSERT INTO users (id, email, name, role, "isActive", "createdAt", "updatedAt")
SELECT
  'cmqlbillingjaden001',
  'jaden.j.brown2025@gmail.com',
  'Jaden Brown',
  'BILLING',
  true,
  NOW(),
  NOW()
WHERE NOT EXISTS (SELECT 1 FROM users WHERE email ILIKE 'jaden.j.brown2025@gmail.com');
