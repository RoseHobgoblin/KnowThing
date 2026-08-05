-- Dedicated store for the application rate limiter (rate-limiter-flexible's
-- RateLimiterDrizzle adapter). The old limiter wrote `app:<ip>:<scope>` keys
-- into auth_rate_limits, a table Better Auth owns and prunes on its own
-- schedule; squatting there meant two limiters sharing one row shape.
--
-- Column names/types are fixed by the adapter (key / points / expire).

CREATE TABLE IF NOT EXISTS rate_limits (
	key TEXT PRIMARY KEY,
	points INTEGER NOT NULL,
	expire TIMESTAMPTZ
);

-- The adapter sweeps rows whose `expire` is over an hour old every 5 minutes.
CREATE INDEX IF NOT EXISTS idx_rate_limits_expire ON rate_limits (expire);

-- Retire the old application keys. Better Auth's own rows (no `app:` prefix)
-- stay put. Guarded because auth_rate_limits arrives in 0049, and a database
-- that predates it should still be able to take this migration.
DO $$
BEGIN
	IF to_regclass('public.auth_rate_limits') IS NOT NULL THEN
		DELETE FROM auth_rate_limits WHERE key LIKE 'app:%';
	END IF;
END $$;
