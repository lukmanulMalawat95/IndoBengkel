import { Module } from "@nestjs/common";
import { CatalogController } from "./catalog.controller";
import { CatalogService } from "./catalog.service";
import { WorkshopGeoRepository } from "./workshop-geo.repository";

@Module({
  controllers: [CatalogController],
  providers: [CatalogService, WorkshopGeoRepository],
})
export class CatalogModule {}
