import { Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { ApiError } from "../common/api-error";
import { uid } from "../common/ids";
import { toIso } from "../common/serializers";

@Injectable()
export class VehiclesService {
  constructor(private readonly prisma: PrismaService) {}

  async list(userId: string) {
    const vehicles = await this.prisma.vehicle.findMany({
      where: { customerId: userId },
      orderBy: { createdAt: "asc" },
    });
    return vehicles.map((vehicle) => this.serialize(vehicle));
  }

  async get(userId: string, id: string) {
    const vehicle = await this.prisma.vehicle.findFirst({ where: { id, customerId: userId } });
    if (!vehicle) throw new ApiError("NOT_FOUND", "Vehicle not found.", 404);
    return this.serialize(vehicle);
  }

  async create(userId: string, input: any) {
    const plateNumber = String(input.plateNumber ?? "").trim().toUpperCase();
    if (!plateNumber) throw new ApiError("VALIDATION_ERROR", "Plate number is required.", 422);
    const duplicate = await this.prisma.vehicle.findFirst({
      where: { customerId: userId, plateNumber },
    });
    if (duplicate) throw new ApiError("PLATE_TAKEN", "This plate is already registered.", 409);

    const vehicle = await this.prisma.vehicle.create({
      data: {
        id: uid("veh"),
        customerId: userId,
        type: input.type === "mobil" ? "mobil" : "motor",
        brand: String(input.brand ?? "").trim(),
        model: String(input.model ?? "").trim(),
        year: Number(input.year) || new Date().getFullYear(),
        plateNumber,
        color: String(input.color ?? "").trim(),
        odometerKm: Number(input.odometerKm) || 0,
        photoUrl: input.photoUrl ? String(input.photoUrl) : null,
        reminderMonths: Number(input.reminderMonths) || 6,
        reminderKm: Number(input.reminderKm) || 5000,
      },
    });
    return this.serialize(vehicle);
  }

  async update(userId: string, id: string, input: any) {
    const vehicle = await this.prisma.vehicle.findFirst({ where: { id, customerId: userId } });
    if (!vehicle) throw new ApiError("NOT_FOUND", "Vehicle not found.", 404);

    const plateNumber = input.plateNumber
      ? String(input.plateNumber).trim().toUpperCase()
      : vehicle.plateNumber;
    if (plateNumber !== vehicle.plateNumber) {
      const duplicate = await this.prisma.vehicle.findFirst({
        where: { customerId: userId, plateNumber, id: { not: id } },
      });
      if (duplicate) throw new ApiError("PLATE_TAKEN", "This plate is already registered.", 409);
    }

    const updated = await this.prisma.vehicle.update({
      where: { id },
      data: {
        type: input.type ?? vehicle.type,
        brand: input.brand ?? vehicle.brand,
        model: input.model ?? vehicle.model,
        year: input.year ?? vehicle.year,
        plateNumber,
        color: input.color ?? vehicle.color,
        photoUrl: input.photoUrl === undefined ? vehicle.photoUrl : input.photoUrl || null,
        reminderMonths: input.reminderMonths ?? vehicle.reminderMonths,
        reminderKm: input.reminderKm ?? vehicle.reminderKm,
      },
    });
    return this.serialize(updated);
  }

  async delete(userId: string, id: string) {
    const vehicle = await this.prisma.vehicle.findFirst({ where: { id, customerId: userId } });
    if (!vehicle) throw new ApiError("NOT_FOUND", "Vehicle not found.", 404);
    const history = await this.prisma.serviceOrder.count({ where: { vehicleId: id } });
    if (history > 0) {
      throw new ApiError(
        "VEHICLE_HAS_HISTORY",
        "This vehicle has service history and cannot be deleted.",
        409,
      );
    }
    await this.prisma.vehicle.delete({ where: { id } });
    return { ok: true };
  }

  private serialize(vehicle: any) {
    return {
      id: vehicle.id,
      customerId: vehicle.customerId,
      type: vehicle.type,
      brand: vehicle.brand,
      model: vehicle.model,
      year: vehicle.year,
      plateNumber: vehicle.plateNumber,
      color: vehicle.color,
      odometerKm: vehicle.odometerKm,
      photoUrl: vehicle.photoUrl ?? undefined,
      reminderMonths: vehicle.reminderMonths,
      reminderKm: vehicle.reminderKm,
      lastServiceAt: toIso(vehicle.lastServiceAt),
      lastWorkshopName: vehicle.lastWorkshopName ?? undefined,
    };
  }
}
