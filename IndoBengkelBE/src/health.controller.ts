import { Controller, Get } from "@nestjs/common";
import { PrismaService } from "./prisma/prisma.service";
import { Public } from "./common/auth/public.decorator";

@Controller()
export class HealthController {
  constructor(private readonly prisma: PrismaService) {}

  @Public()
  @Get("health")
  async health() {
    await this.prisma.$queryRaw`SELECT 1`;
    return {
      status: "ok",
      service: "indobengkel-api",
      database: "up",
      timestamp: new Date().toISOString(),
    };
  }

  @Public()
  @Get()
  root() {
    return {
      service: "IndoBengkel API",
      version: "1.0.0",
      docs: "/api/v1/health",
    };
  }
}
