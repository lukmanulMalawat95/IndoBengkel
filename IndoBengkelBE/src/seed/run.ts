import { PrismaClient } from "@prisma/client";
import { seedDatabase } from "./seed";

async function main() {
  const prisma = new PrismaClient();
  try {
    const summary = await seedDatabase(prisma);
    // eslint-disable-next-line no-console
    console.log("Seed complete", summary);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  // eslint-disable-next-line no-console
  console.error("Seed failed", error);
  process.exit(1);
});
