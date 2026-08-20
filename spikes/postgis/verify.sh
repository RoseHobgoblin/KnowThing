#!/usr/bin/env sh
set -eu
cd "$(dirname "$0")"
trap 'docker compose down --volumes --remove-orphans' EXIT
docker compose up -d --wait
docker compose exec -T db psql -U knowthing -d planetary_spike < verify.sql
docker compose exec -T db pg_dump -U knowthing -Fc planetary_spike -f /tmp/planetary-spike.dump
docker compose exec -T db createdb -U knowthing planetary_spike_restore
docker compose exec -T db pg_restore -U knowthing -d planetary_spike_restore /tmp/planetary-spike.dump
count="$(docker compose exec -T db psql -U knowthing -d planetary_spike_restore -Atc 'SELECT count(*) FROM spike_features;')"
[ "$count" = 5 ]
echo 'PostGIS planetary CRS spike passed, including dump/restore.'
