-- Replace the hand-rolled credential/session schema with Better Auth while
-- preserving the integer user ids referenced throughout the content schema.

DO $$
BEGIN
	IF EXISTS (
		SELECT 1
		FROM users
		GROUP BY LOWER(username)
		HAVING COUNT(*) > 1
	) THEN
		RAISE EXCEPTION 'Better Auth migration blocked: usernames collide when normalized to lowercase';
	END IF;
END $$;

ALTER TABLE users
	ADD COLUMN display_username TEXT,
	ADD COLUMN name TEXT,
	ADD COLUMN email TEXT,
	ADD COLUMN email_verified BOOLEAN NOT NULL DEFAULT FALSE,
	ADD COLUMN image TEXT,
	ADD COLUMN updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

UPDATE users
SET
	display_username = username,
	name = username,
	email = 'user-' || id || '@users.knowthing.invalid',
	username = LOWER(username);

ALTER TABLE users
	ALTER COLUMN name SET NOT NULL,
	ALTER COLUMN email SET NOT NULL;

CREATE UNIQUE INDEX users_email_unique ON users (email);

CREATE TABLE accounts (
	id SERIAL PRIMARY KEY,
	account_id TEXT NOT NULL,
	provider_id TEXT NOT NULL,
	user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
	access_token TEXT,
	refresh_token TEXT,
	id_token TEXT,
	access_token_expires_at TIMESTAMPTZ,
	refresh_token_expires_at TIMESTAMPTZ,
	scope TEXT,
	password TEXT,
	created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
	updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_accounts_user_id ON accounts(user_id);
CREATE UNIQUE INDEX uq_accounts_provider_account ON accounts(provider_id, account_id);

INSERT INTO accounts (account_id, provider_id, user_id, password, created_at, updated_at)
SELECT id::TEXT, 'credential', id, password_hash, created_at, NOW()
FROM users;

ALTER TABLE users DROP COLUMN password_hash;

-- Legacy cookies point at these rows. Clearing the table makes the cutover an
-- explicit global logout instead of attempting to preserve two token formats.
TRUNCATE TABLE sessions RESTART IDENTITY;
ALTER TABLE sessions
	ADD COLUMN created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
	ADD COLUMN updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
	ADD COLUMN ip_address TEXT,
	ADD COLUMN user_agent TEXT;

CREATE TABLE verifications (
	id SERIAL PRIMARY KEY,
	identifier TEXT NOT NULL,
	value TEXT NOT NULL,
	expires_at TIMESTAMPTZ NOT NULL,
	created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
	updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_verifications_identifier ON verifications(identifier);

CREATE TABLE auth_rate_limits (
	id SERIAL PRIMARY KEY,
	key TEXT NOT NULL UNIQUE,
	count INTEGER NOT NULL,
	last_request BIGINT NOT NULL
);

DROP TABLE login_attempts;
