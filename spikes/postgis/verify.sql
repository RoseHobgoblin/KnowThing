\set ON_ERROR_STOP on

DO $$
BEGIN
	IF NOT EXISTS (
		SELECT 1 FROM spatial_ref_sys
		WHERE auth_name = 'KNOWTHING' AND srid = 990001 AND srtext LIKE 'GEOGCRS%'
	) THEN RAISE EXCEPTION 'Custom Mars WKT2 was not registered'; END IF;
	IF EXISTS (SELECT 1 FROM spike_spaces WHERE crs_key LIKE 'epsg:%') THEN
		RAISE EXCEPTION 'Planetary spaces must not use an EPSG application identity';
	END IF;
END $$;

-- Controlled same-body projection round trip.
DO $$
DECLARE source geometry; projected geometry; returned geometry;
BEGIN
	source := ST_SetSRID(ST_Point(137.4, -4.6), 990001);
	projected := ST_Transform(source, 990002);
	returned := ST_Transform(projected, 990001);
	IF ST_Distance(source, returned) > 0.000001 THEN
		RAISE EXCEPTION 'Mars transform round trip exceeded tolerance';
	END IF;
END $$;

DO $$
BEGIN
	IF (SELECT count(*) FROM spike_features WHERE NOT ST_IsValid(geom)) <> 0 THEN
		RAISE EXCEPTION 'Fixture contains invalid geometry';
	END IF;
	IF (SELECT count(*) FROM spike_features
		WHERE space_id = 1 AND geom && ST_MakeEnvelope(160, -20, 180, 20, 990001)) <> 1 THEN
		RAISE EXCEPTION 'Antimeridian spatial query failed';
	END IF;
	IF (SELECT count(*) FROM spike_features
		WHERE space_id = 1 AND geom && ST_MakeEnvelope(-180, 79, 180, 90, 990001)) <> 1 THEN
		RAISE EXCEPTION 'Polar spatial query failed';
	END IF;
END $$;

-- MVT generation operates on the projected Mars representation.
DO $$
DECLARE tile bytea;
BEGIN
	WITH bounds AS (
		SELECT ST_Envelope(ST_Collect(ST_Transform(geom, 990002))) AS geom
		FROM spike_features WHERE space_id = 1
	), rows AS (
		SELECT id, name, ST_AsMVTGeom(ST_Transform(feature.geom, 990002), bounds.geom, 4096, 64, true) AS geom
		FROM spike_features feature CROSS JOIN bounds WHERE feature.space_id = 1
	)
	SELECT ST_AsMVT(rows, 'mars', 4096, 'geom') INTO tile FROM rows;
	IF tile IS NULL OR octet_length(tile) = 0 THEN RAISE EXCEPTION 'Mars vector tile was empty'; END IF;
END $$;

-- A feature cannot be silently attached to a different rodder space.
DO $$
BEGIN
	BEGIN
		INSERT INTO spike_features (space_id, name, geom)
		VALUES (2, 'Invalid cross-body feature', ST_SetSRID(ST_Point(0, 0), 990001));
		RAISE EXCEPTION 'Cross-body SRID mismatch was accepted';
	EXCEPTION WHEN raise_exception THEN
		IF SQLERRM = 'Cross-body SRID mismatch was accepted' THEN RAISE; END IF;
	END;
END $$;

SELECT 'planetary CRS spike passed' AS result;
