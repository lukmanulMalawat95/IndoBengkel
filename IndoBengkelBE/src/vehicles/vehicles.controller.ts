import { Body, Controller, Delete, Get, Param, Patch, Post } from "@nestjs/common";
import { VehiclesService } from "./vehicles.service";
import { CurrentUser } from "../common/auth/current-user.decorator";

@Controller("vehicles")
export class VehiclesController {
  constructor(private readonly vehicles: VehiclesService) {}

  @Get()
  async list(@CurrentUser() user: any) {
    return { data: await this.vehicles.list(user.id) };
  }

  @Post()
  async create(@CurrentUser() user: any, @Body() body: any) {
    return { data: await this.vehicles.create(user.id, body) };
  }

  @Get(":id")
  async get(@CurrentUser() user: any, @Param("id") id: string) {
    return { data: await this.vehicles.get(user.id, id) };
  }

  @Patch(":id")
  async update(@CurrentUser() user: any, @Param("id") id: string, @Body() body: any) {
    return { data: await this.vehicles.update(user.id, id, body) };
  }

  @Delete(":id")
  async delete(@CurrentUser() user: any, @Param("id") id: string) {
    return { data: await this.vehicles.delete(user.id, id) };
  }
}
