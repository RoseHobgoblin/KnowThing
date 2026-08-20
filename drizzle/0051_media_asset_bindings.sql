-- Stable, revision-pinned Media bindings for structured records. Unlike parsed
-- wiki usage, these bindings survive filename changes and prevent deletion of
-- assets that provide a planet or star surface.

CREATE TABLE IF NOT EXISTS media_asset_bindings (
	id serial PRIMARY KEY,
	media_id integer NOT NULL REFERENCES media(id) ON DELETE RESTRICT,
	owner_type text NOT NULL,
	owner_id integer NOT NULL,
	slot text NOT NULL,
	content_hash text NOT NULL,
	filename_snapshot text NOT NULL,
	interpretation jsonb NOT NULL DEFAULT '{}'::jsonb,
	created_at timestamptz NOT NULL DEFAULT now(),
	updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS uidx_media_asset_binding_owner_slot
	ON media_asset_bindings (owner_type, owner_id, slot);
CREATE INDEX IF NOT EXISTS idx_media_asset_bindings_media
	ON media_asset_bindings (media_id);
CREATE INDEX IF NOT EXISTS idx_media_asset_bindings_owner
	ON media_asset_bindings (owner_type, owner_id);

-- Register any existing filename-based surface maps. Their JSON is upgraded to
-- ID/hash bindings the next time the owner is saved; this backfill immediately
-- makes rename/delete usage truthful in the meantime.
INSERT INTO media_asset_bindings (
	media_id, owner_type, owner_id, slot, content_hash, filename_snapshot, interpretation
)
SELECT
	m.id,
	'celestial',
	cb.id,
	'surface.' || maps.key,
	COALESCE(NULLIF(maps.value->>'contentHash', ''), m.hash),
	m.filename,
	COALESCE(maps.value->'interpretation', '{}'::jsonb)
FROM celestial_bodies cb
CROSS JOIN LATERAL jsonb_each(COALESCE(cb.extra #> '{surface,maps}', '{}'::jsonb)) AS maps(key, value)
JOIN media m ON m.filename = CASE
	WHEN jsonb_typeof(maps.value) = 'string' THEN maps.value #>> '{}'
	ELSE maps.value->>'filename'
END
WHERE cb.kind = 'body'
	AND maps.key IN ('albedo', 'elevation', 'normal', 'roughness', 'clouds', 'emissive')
	AND m.hash IS NOT NULL
ON CONFLICT (owner_type, owner_id, slot) DO NOTHING;

INSERT INTO media_asset_bindings (
	media_id, owner_type, owner_id, slot, content_hash, filename_snapshot, interpretation
)
SELECT
	m.id,
	'celestial',
	cb.id,
	'stellarSurface.photosphere',
	COALESCE(NULLIF(map.value->>'contentHash', ''), m.hash),
	m.filename,
	COALESCE(map.value->'interpretation', '{}'::jsonb)
FROM celestial_bodies cb
CROSS JOIN LATERAL (
	SELECT cb.extra #> '{stellarSurface,maps,photosphere}' AS value
) map
JOIN media m ON m.filename = CASE
	WHEN jsonb_typeof(map.value) = 'string' THEN map.value #>> '{}'
	ELSE map.value->>'filename'
END
WHERE cb.kind = 'star'
	AND map.value IS NOT NULL
	AND m.hash IS NOT NULL
ON CONFLICT (owner_type, owner_id, slot) DO NOTHING;
