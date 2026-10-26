import { Controller, Get, Param, Query } from "@nestjs/common";
import { CatalogService } from "./catalog.service";
import { Public } from "../common/auth/public.decorator";
import { numberOrUndefined } from "../common/geo";

@Controller()
export class CatalogController {
  constructor(private readonly catalog: CatalogService) {}

  @Public()
  @Get("workshops")
  async listWorkshops(@Query() query: any) {
    return this.catalog.listWorkshops(query);
  }

  @Public()
  @Get("workshops/:id/availability")
  async availability(@Param("id") id: string, @Query("date") date: string) {
    return { data: await this.catalog.getAvailability(id, date) };
  }

  @Public()
  @Get("workshops/:slug")
  async getWorkshop(
    @Param("slug") slug: string,
    @Query("lat") lat?: string,
    @Query("lng") lng?: string,
  ) {
    return {
      data: await this.catalog.getWorkshop(slug, numberOrUndefined(lat), numberOrUndefined(lng)),
    };
  }

  @Public()
  @Get("products")
  async listProducts(@Query() query: any) {
    return this.catalog.listProducts(query);
  }

  @Public()
  @Get("products/:slug")
  async getProduct(@Param("slug") slug: string) {
    return { data: await this.catalog.getProduct(slug) };
  }
}
