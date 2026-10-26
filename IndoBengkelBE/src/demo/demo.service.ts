import { Injectable, Logger } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { seedDatabase } from "../seed/seed";

@Injectable()
export class DemoService {
  private readonly logger = new Logger(DemoService.name);
  private resetting = false;

  constructor(private readonly prisma: PrismaService) {}

  async reset() {
    if (this.resetting) {
      return { ok: true, message: "Reset already in progress." };
    }
    this.resetting = true;
    try {
      const summary = await seedDatabase(this.prisma);
      this.logger.log(`Demo data reset: ${JSON.stringify(summary)}`);
      return { ok: true, summary };
    } finally {
      this.resetting = false;
    }
  }
}
