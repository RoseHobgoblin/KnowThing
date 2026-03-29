-- Seed the Sunly system from existing wiki articles

-- The Sun (primary star)
INSERT INTO stars (name, slug, page_slug, spectral_type, mass, radius, luminosity, temperature, age, color, apparent_magnitude, angular_diameter, companion, extra)
VALUES (
  'The Sun', 'the-sun', 'Sun',
  'G2V',
  '1.0 [[Sunly mass|M☉]]',
  '1.0 [[Sunly radius|R☉]]',
  '1.0 [[Sunly luminosity|L☉]]',
  '5,778 [[Kelvin|K]]',
  '~4.6 billion years',
  'Yellow-white',
  '−26.7',
  '31.4 [[Arcminute|arcmin]]',
  '[[Therne]] (M3V, 30 AU)',
  '{"mean_distance": "1.02 [[Astronomical unit|AU]] (from [[Earth]])", "caption": "The Sun, viewed through a clear sunly filter"}'::jsonb
)
ON CONFLICT (slug) DO NOTHING;

-- Therne (binary companion)
INSERT INTO stars (name, slug, page_slug, spectral_type, mass, radius, luminosity, luminosity_visual, temperature, age, color, orbital_period, semi_major_axis, semi_major_axis_au, eccentricity, periastron, apastron, companion, parent_star_id, extra)
VALUES (
  'Therne', 'therne', 'Therne',
  'M3V',
  '0.36 [[Sunly mass|M☉]]',
  '0.39 [[Sunly radius|R☉]]',
  '0.015 [[Sunly luminosity|L☉]] (bolometric)',
  '0.0013 [[Sunly luminosity|L☉]] (V-band)',
  '3,400 [[Kelvin|K]]',
  '~4.6 billion years',
  'Deep orange-red',
  '140.9 years',
  '30 [[Astronomical unit|AU]]',
  30.0,
  0.3,
  '21.0 AU',
  '39.0 AU',
  '[[The Sun]] (G2V)',
  (SELECT id FROM stars WHERE slug = 'the-sun'),
  '{"apparent_magnitude_bright": "−13.3 (periastron opposition)", "apparent_magnitude_dim": "−11.9 (apastron conjunction)", "angular_diameter_max": "35.6 [[Arcsecond|arcsec]] (periastron)", "angular_diameter_min": "19.2 arcsec (apastron)", "caption": "Therne near opposition, composite long-exposure image"}'::jsonb
)
ON CONFLICT (slug) DO NOTHING;
