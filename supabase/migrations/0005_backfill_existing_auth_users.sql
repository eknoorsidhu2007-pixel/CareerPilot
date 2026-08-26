-- 0005 backfill users who signed up before the repo trigger existed
-- Idempotent: safe to re-run.
--
-- handle_new_user (migration 0003) fires AFTER INSERT ON auth.users, so it does
-- nothing for accounts that already exist. Without this, a pre-existing login
-- has an auth.users row but no public.users or public.profiles row, and the app
-- behaves as though the account is not there.

INSERT INTO public.users (id, email)
SELECT id, email FROM auth.users
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.profiles (user_id)
SELECT id FROM auth.users
ON CONFLICT (user_id) DO NOTHING;
