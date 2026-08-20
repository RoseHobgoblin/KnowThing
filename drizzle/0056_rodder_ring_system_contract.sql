-- Establish the versioned ring-system facet for legacy child records. Empty
-- bands mean authored extent is unavailable; they do not invent dimensions.
UPDATE rodder_bodies
SET extra = jsonb_set(
	COALESCE(extra, '{}'::jsonb),
	'{ringSystem}',
	'{"schemaVersion":1,"plane":"parent-equatorial","bands":[]}'::jsonb,
	true
)
WHERE kind = 'body'
	AND body_type = 'ring_system'
	AND NOT COALESCE(extra, '{}'::jsonb) ? 'ringSystem';
