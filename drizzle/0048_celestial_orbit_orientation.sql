-- ============================================================================
-- Add the two orbital-orientation elements that finish the classical set.
--
-- celestial_bodies already stores a, e, inclination (i) and epoch_phase, but a
-- non-zero inclination alone is underdetermined — you cannot place an orbit in
-- 3D without also knowing how the plane is swivelled and where periapsis sits.
--   longitude_ascending_node (Ω): rotates the tilted plane about the reference axis
--   argument_of_periapsis    (ω): rotates the ellipse within its own plane
-- Both in degrees, nullable (a plain untilted orbit leaves them empty). They
-- feed tungolcraft's stateVectorAtEpoch / velocityAtTrueAnomaly propagation.
-- ============================================================================

ALTER TABLE celestial_bodies ADD COLUMN IF NOT EXISTS longitude_ascending_node double precision;
ALTER TABLE celestial_bodies ADD COLUMN IF NOT EXISTS argument_of_periapsis double precision;
