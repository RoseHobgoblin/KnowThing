CREATE EXTENSION IF NOT EXISTS postgis;

-- Application identity is stable and descriptive. Internal SRIDs are an
-- implementation detail and deliberately do not impersonate EPSG records.
DELETE FROM spatial_ref_sys WHERE srid BETWEEN 990000 AND 990999;
INSERT INTO spatial_ref_sys (srid, auth_name, auth_srid, srtext, proj4text) VALUES
(
	990001, 'KNOWTHING', 990001,
	'GEOGCRS["Mars 2000 planetocentric",DATUM["Mars 2000",ELLIPSOID["Mars 2000",3396190,169.894447223612]],PRIMEM["Reference meridian",0],CS[ellipsoidal,2],AXIS["planetocentric latitude",north,ORDER[1]],AXIS["positive-east longitude",east,ORDER[2]],ANGLEUNIT["degree",0.0174532925199433],ID["KNOWTHING",990001]]',
	'+proj=longlat +a=3396190 +b=3376200 +no_defs +type=crs'
),
(
	990002, 'KNOWTHING', 990002,
	'PROJCRS["Mars simple cylindrical",BASEGEOGCRS["Mars 2000 planetocentric",DATUM["Mars 2000",ELLIPSOID["Mars 2000",3396190,169.894447223612]],PRIMEM["Reference meridian",0]],CONVERSION["Simple cylindrical",METHOD["Equidistant Cylindrical",ID["EPSG",1028]],PARAMETER["Latitude of 1st standard parallel",0,ANGLEUNIT["degree",0.0174532925199433]],PARAMETER["Longitude of natural origin",0,ANGLEUNIT["degree",0.0174532925199433]],PARAMETER["False easting",0,LENGTHUNIT["metre",1]],PARAMETER["False northing",0,LENGTHUNIT["metre",1]]],CS[Cartesian,2],AXIS["easting",east,ORDER[1]],AXIS["northing",north,ORDER[2]],LENGTHUNIT["metre",1],ID["KNOWTHING",990002]]',
	'+proj=eqc +lat_ts=0 +lat_0=0 +lon_0=0 +x_0=0 +y_0=0 +a=3396190 +b=3376200 +units=m +no_defs +type=crs'
),
(
	990101, 'KNOWTHING', 990101,
	'GEOGCRS["Fictional sphere",DATUM["Fictional sphere datum",ELLIPSOID["Fictional sphere",6000000,0]],PRIMEM["Reference meridian",0],CS[ellipsoidal,2],AXIS["latitude",north,ORDER[1]],AXIS["positive-east longitude",east,ORDER[2]],ANGLEUNIT["degree",0.0174532925199433],ID["KNOWTHING",990101]]',
	'+proj=longlat +R=6000000 +no_defs +type=crs'
),
(
	990201, 'KNOWTHING', 990201,
	'ENGCRS["Local authored plane",EDATUM["Local authored datum"],CS[Cartesian,2],AXIS["x",east,ORDER[1]],AXIS["y",north,ORDER[2]],LENGTHUNIT["metre",1],ID["KNOWTHING",990201]]',
	'+proj=affine +units=m +type=crs'
);

CREATE TABLE spike_spaces (
	id integer PRIMARY KEY,
	crs_key text UNIQUE NOT NULL,
	db_srid integer UNIQUE NOT NULL REFERENCES spatial_ref_sys(srid),
	body_key text NOT NULL,
	coordinate_kind text NOT NULL CHECK (coordinate_kind IN ('body-fixed-geographic', 'local-planar')),
	longitude_direction text,
	latitude_type text
);

INSERT INTO spike_spaces VALUES
	(1, 'mars:iau-mars-planetocentric-east', 990001, 'mars', 'body-fixed-geographic', 'positive-east', 'planetocentric'),
	(2, 'fictional:pelagos-sphere-east', 990101, 'pelagos', 'body-fixed-geographic', 'positive-east', 'spherical'),
	(3, 'fictional:station-local-metres', 990201, 'pelagos', 'local-planar', NULL, NULL);

CREATE TABLE spike_features (
	id serial PRIMARY KEY,
	space_id integer NOT NULL REFERENCES spike_spaces(id),
	name text NOT NULL,
	geom geometry NOT NULL
);

CREATE INDEX spike_features_geom_gist ON spike_features USING gist (geom);

CREATE FUNCTION spike_enforce_space_srid() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE expected_srid integer;
BEGIN
	SELECT db_srid INTO expected_srid FROM spike_spaces WHERE id = NEW.space_id;
	IF ST_SRID(NEW.geom) <> expected_srid THEN
		RAISE EXCEPTION 'Geometry SRID % does not match space SRID %', ST_SRID(NEW.geom), expected_srid;
	END IF;
	RETURN NEW;
END $$;

CREATE TRIGGER spike_features_space_srid
	BEFORE INSERT OR UPDATE ON spike_features
	FOR EACH ROW EXECUTE FUNCTION spike_enforce_space_srid();

INSERT INTO spike_features (space_id, name, geom) VALUES
	(1, 'Olympus Mons', ST_SetSRID(ST_Point(226.2, 18.65), 990001)),
	(1, 'Antimeridian study area', ST_GeomFromText('MULTIPOLYGON(((170 -10,180 -10,180 10,170 10,170 -10)),((-180 -10,-170 -10,-170 10,-180 10,-180 -10)))', 990001)),
	(1, 'North polar cap', ST_GeomFromText('POLYGON((-180 80,-90 80,0 80,90 80,180 80,180 90,-180 90,-180 80))', 990001)),
	(2, 'Pelagos capital', ST_SetSRID(ST_Point(34, -12), 990101)),
	(3, 'Station deck', ST_GeomFromText('POLYGON((0 0,100 0,100 50,0 50,0 0))', 990201));
