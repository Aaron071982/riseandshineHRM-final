-- Delete all payroll cycle data; keep RBT pay rates on rbt_profiles and payroll_only_people.
-- Order respects FKs (sessions → entries → cycles; hours confirmations → cycles).

DELETE FROM billing_sessions;
DELETE FROM billing_hours_confirmations;
DELETE FROM billing_entries;
DELETE FROM billing_cycles;

-- rbt_profiles.hourlyPayRate, artemisProviderName, payRateUpdatedAt, payRateUpdatedBy are NOT modified.
