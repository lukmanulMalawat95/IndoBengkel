/**
 * Creates (or refreshes) the isolated test schema and loads the curated
 * demo snapshot, so every suite starts from the same known data.
 */
import "./setup-env";
import { execFileSync } from "node:child_process";
import { resolve } from "node:path";
import { PrismaClient } from "@prisma/client";
import { seedDatabase } from "../src/seed/seed";

export default async function globalSetup() {
  const root = resolve(__dirname, "..");
  const prismaCli = resolve(root, "node_modules", "prisma", "build", "index.js");

  execFileSync(
    process.execPath,
    [prismaCli, "db", "push", "--skip-generate", "--accept-data-loss"],
    {
      cwd: root,
      env: process.env,
      stdio: "inherit",
    },
  );

  const prisma = new PrismaClient();
  try {
    // `db push` only creates tables, so the PostGIS objects from
    // `prisma/migrations/1_postgis_workshop_location` are recreated here.
    // Nearest-search tests fail loudly if this is skipped, never silently.
    await prisma.$executeRawUnsafe(`CREATE EXTENSION IF NOT EXISTS postgis`);
    await prisma.$executeRawUnsafe(
      `CREATE INDEX IF NOT EXISTS "Workshop_location_gist"
         ON "Workshop"
         USING GIST ((public.ST_SetSRID(public.ST_MakePoint("lng", "lat"), 4326)::public.geography))`,
    );

    const summary = await seedDatabase(prisma);
    console.log(
      `[e2e] seeded test schema: ${summary.workshops} workshops, ${summary.serviceOrders} service orders, ${summary.orders} shop orders`,
    );
  } finally {
    await prisma.$disconnect();
  }
}
