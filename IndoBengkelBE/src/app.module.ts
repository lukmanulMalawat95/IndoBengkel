import { Module } from "@nestjs/common";
import { APP_GUARD, APP_INTERCEPTOR } from "@nestjs/core";
import { PrismaModule } from "./prisma/prisma.module";
import { AuthModule } from "./auth/auth.module";
import { CatalogModule } from "./catalog/catalog.module";
import { CommerceModule } from "./commerce/commerce.module";
import { VehiclesModule } from "./vehicles/vehicles.module";
import { BookingsModule } from "./bookings/bookings.module";
import { WorkshopModule } from "./workshop/workshop.module";
import { MessagingModule } from "./messaging/messaging.module";
import { DemoModule } from "./demo/demo.module";
import { UploadsModule } from "./uploads/uploads.module";
import { HealthController } from "./health.controller";
import { SessionGuard } from "./common/auth/session.guard";
import { CsrfGuard } from "./common/security/csrf";
import { RateLimitGuard } from "./common/security/rate-limit";
import { UploadOwnershipInterceptor } from "./common/security/upload-ownership.interceptor";

@Module({
  imports: [
    PrismaModule,
    AuthModule,
    CatalogModule,
    CommerceModule,
    VehiclesModule,
    BookingsModule,
    WorkshopModule,
    MessagingModule,
    DemoModule,
    UploadsModule,
  ],
  controllers: [HealthController],
  providers: [
    // Cheapest rejection first: throttle before touching the database.
    {
      provide: APP_GUARD,
      useClass: RateLimitGuard,
    },
    {
      provide: APP_GUARD,
      useClass: SessionGuard,
    },
    {
      provide: APP_GUARD,
      useClass: CsrfGuard,
    },
    {
      provide: APP_INTERCEPTOR,
      useClass: UploadOwnershipInterceptor,
    },
  ],
})
export class AppModule {}
