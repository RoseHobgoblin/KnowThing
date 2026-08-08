$ErrorActionPreference = 'Stop'
$compose = Join-Path $PSScriptRoot 'docker-compose.yml'

try {
  docker compose -f $compose up -d --wait
  Get-Content -Raw (Join-Path $PSScriptRoot 'verify.sql') | docker compose -f $compose exec -T db psql -U knowthing -d planetary_spike
  docker compose -f $compose exec -T db pg_dump -U knowthing -Fc planetary_spike -f /tmp/planetary-spike.dump
  docker compose -f $compose exec -T db createdb -U knowthing planetary_spike_restore
  docker compose -f $compose exec -T db pg_restore -U knowthing -d planetary_spike_restore /tmp/planetary-spike.dump
  $count = docker compose -f $compose exec -T db psql -U knowthing -d planetary_spike_restore -Atc 'SELECT count(*) FROM spike_features;'
  if ([int]$count -ne 5) { throw "Dump/restore feature count was $count, expected 5" }
  Write-Output 'PostGIS planetary CRS spike passed, including dump/restore.'
}
finally {
  docker compose -f $compose down --volumes --remove-orphans
}
