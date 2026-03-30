-- ============================================================================
-- Auth upgrades: registration codes, role tiers, login throttling
-- ============================================================================

-- Registration codes (invite-only system)
CREATE TABLE registration_codes (
    id SERIAL PRIMARY KEY,
    code TEXT UNIQUE NOT NULL,
    created_by INT REFERENCES users(id),
    used_by INT REFERENCES users(id),
    role TEXT NOT NULL DEFAULT 'editor',  -- what role the code grants
    used_at TIMESTAMPTZ,
    expires_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_regcodes_code ON registration_codes(code);

-- Login attempt tracking (for throttling)
CREATE TABLE login_attempts (
    id SERIAL PRIMARY KEY,
    username TEXT NOT NULL,
    ip_address TEXT,
    success BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_login_attempts_username ON login_attempts(username, created_at);
CREATE INDEX idx_login_attempts_ip ON login_attempts(ip_address, created_at);

-- Upgrade first user from 'admin' to 'owner'
UPDATE users SET role = 'owner' WHERE id = (SELECT MIN(id) FROM users);
