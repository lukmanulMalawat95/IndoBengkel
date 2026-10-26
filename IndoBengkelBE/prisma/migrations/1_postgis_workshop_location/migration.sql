-- PostGIS powers nearest-workshop discovery (`GET /workshops?lat=&lng=`).
--
-- The GiST index is built over an expression instead of a stored `geography`
-- column. Prisma cannot model `geography` natively, and an expression index is
-- invisible to `prisma migrate diff`, so `schema.prisma` remains the single
-- source of truth without an `Unsupported(...)` column kept in sync by hand.
-- The expression below MUST match the one used by CatalogService raw queries,
-- otherwise PostgreSQL cannot use the index for KNN ordering.
CREATE EXTENSION IF NOT EXISTS postgis;

CREATE INDEX IF NOT EXISTS "Workshop_location_gist"
  ON "Workshop"
  USING GIST ((ST_SetSRID(ST_MakePoint("lng", "lat"), 4326)::geography));
