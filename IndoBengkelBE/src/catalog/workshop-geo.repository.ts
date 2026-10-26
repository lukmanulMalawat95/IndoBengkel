import { Injectable } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { jakartaNow } from "../common/geo";

/**
 * Raw PostGIS access for workshop discovery.
 *
 * PostGIS functions, types and the `<->` operator are qualified with `public.`
 * on purpose: Prisma pins `search_path` to the datasource schema, and the API
 * suite runs in the `indobengkel_test` schema, where unqualified PostGIS names
 * would not resolve.
 *
 * The point expression must stay identical to the one in
 * `prisma/migrations/1_postgis_workshop_location/migration.sql`; a different
 * expression cannot use the `Workshop_location_gist` index for KNN ordering.
 * For the same reason the nearest-first query cannot add a secondary sort key:
 * a tie-breaker forces a full sort and the planner drops the index scan.
 */
const WORKSHOP_POINT = Prisma.sql`public.ST_SetSRID(public.ST_MakePoint(w."lng", w."lat"), 4326)::public.geography`;

export type WorkshopSort = "distance" | "rating" | "name";

export interface WorkshopSearchParams {
  lat?: number;
  lng?: number;
  radiusKm?: number;
  type?: string;
  minRating?: number;
  openNow?: boolean;
  query?: string;
  sort: WorkshopSort;
  page: number;
  perPage: number;
}

export interface WorkshopSearchRow {
  id: string;
  distanceKm: number | null;
}

@Injectable()
export class WorkshopGeoRepository {
  constructor(private readonly prisma: PrismaService) {}

  async search(params: WorkshopSearchParams): Promise<{ rows: WorkshopSearchRow[]; total: number }> {
    const hasPoint = params.lat !== undefined && params.lng !== undefined;
    const point = hasPoint
      ? Prisma.sql`public.ST_SetSRID(public.ST_MakePoint(${params.lng}::float8, ${params.lat}::float8), 4326)::public.geography`
      : Prisma.empty;

    const filters: Prisma.Sql[] = [Prisma.sql`w."status" = 'active'`];
    if (params.type) filters.push(Prisma.sql`w."workshopType" = ${params.type}`);
    if (params.minRating !== undefined) {
      filters.push(Prisma.sql`w."ratingAvg" >= ${params.minRating}::float8`);
    }
    if (params.query) {
      const pattern = `%${params.query.replace(/[\\%_]/g, "\\$&")}%`;
      filters.push(
        Prisma.sql`(w."name" ILIKE ${pattern} OR w."city" ILIKE ${pattern} OR w."addressLine" ILIKE ${pattern})`,
      );
    }
    if (params.openNow) {
      const now = jakartaNow();
      filters.push(Prisma.sql`EXISTS (
        SELECT 1 FROM jsonb_array_elements(w."hours") AS h
        WHERE (h->>'dayOfWeek')::int = ${now.day}::int
          AND COALESCE((h->>'isClosed')::boolean, false) = false
          AND (split_part(h->>'openTime', ':', 1)::int * 60 + split_part(h->>'openTime', ':', 2)::int) <= ${now.minutes}::int
          AND (split_part(h->>'closeTime', ':', 1)::int * 60 + split_part(h->>'closeTime', ':', 2)::int) > ${now.minutes}::int
      ) AND NOT EXISTS (
        SELECT 1 FROM jsonb_array_elements(w."closures") AS c
        WHERE c->>'date' = ${now.dateKey}
      )`);
    }
    if (hasPoint && params.radiusKm !== undefined && params.radiusKm > 0) {
      filters.push(Prisma.sql`${WORKSHOP_POINT} OPERATOR(public.<->) ${point} <= ${params.radiusKm * 1000}::float8`);
    }

    const where = Prisma.join(filters, " AND ");
    const distanceKm = hasPoint
      ? Prisma.sql`((${WORKSHOP_POINT} OPERATOR(public.<->) ${point}) / 1000.0)::float8`
      : Prisma.sql`NULL::float8`;
    const offset = (params.page - 1) * params.perPage;

    const [rows, counted] = await Promise.all([
      this.prisma.$queryRaw<WorkshopSearchRow[]>(Prisma.sql`
        SELECT w."id" AS "id",
               ${distanceKm} AS "distanceKm"
        FROM "Workshop" w
        WHERE ${where}
        ORDER BY ${this.orderBy(params.sort, hasPoint, point)}
        LIMIT ${params.perPage}::int OFFSET ${offset}::int
      `),
      this.prisma.$queryRaw<{ total: number }[]>(Prisma.sql`
        SELECT COUNT(*)::int AS "total" FROM "Workshop" w WHERE ${where}
      `),
    ]);

    return { rows, total: counted[0]?.total ?? 0 };
  }

  private orderBy(sort: WorkshopSort, hasPoint: boolean, point: Prisma.Sql): Prisma.Sql {
    if (sort === "rating") return Prisma.sql`w."ratingAvg" DESC, w."id" ASC`;
    if (sort === "name") return Prisma.sql`w."name" ASC, w."id" ASC`;
    // Distance-only ordering: a secondary key would disable the KNN index scan.
    if (hasPoint) return Prisma.sql`${WORKSHOP_POINT} OPERATOR(public.<->) ${point} ASC`;
    return Prisma.sql`w."id" ASC`;
  }
}
