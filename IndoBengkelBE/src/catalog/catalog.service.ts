import { Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { ApiError } from "../common/api-error";
import {
  asClosures,
  asHours,
  booleanOrUndefined,
  dateKeyInJakarta,
  numberOrUndefined,
  paginate,
} from "../common/geo";
import { productJson, workshopJson } from "../common/serializers";
import { WorkshopGeoRepository, WorkshopSort } from "./workshop-geo.repository";

const WIB_OFFSET = "+07:00";

const workshopInclude = {
  services: true,
  mechanics: true,
  products: true,
  reviews: { orderBy: { createdAt: "desc" as const } },
};

@Injectable()
export class CatalogService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly workshopGeo: WorkshopGeoRepository,
  ) {}

  async listWorkshops(query: any) {
    const lat = numberOrUndefined(query.lat);
    const lng = numberOrUndefined(query.lng);
    const radiusKm = numberOrUndefined(query.radius);
    const minRating = numberOrUndefined(query.minRating);
    const openNow = booleanOrUndefined(query.openNow);
    const type = typeof query.type === "string" && query.type && query.type !== "all" ? query.type : undefined;
    const search = typeof query.q === "string" && query.q.trim() ? query.q.trim() : undefined;
    const sort: WorkshopSort = query.sort === "rating" ? "rating" : query.sort === "name" ? "name" : "distance";
    const page = Math.max(1, Math.trunc(numberOrUndefined(query.page) || 1));
    const perPage = Math.min(100, Math.max(1, Math.trunc(numberOrUndefined(query.perPage) || 20)));

    const { rows, total } = await this.workshopGeo.search({
      lat,
      lng,
      radiusKm,
      type,
      minRating,
      openNow,
      query: search,
      sort,
      page,
      perPage,
    });

    const workshops = rows.length
      ? await this.prisma.workshop.findMany({
          where: { id: { in: rows.map((row) => row.id) } },
          include: workshopInclude,
        })
      : [];
    const byId = new Map(workshops.map((workshop) => [workshop.id, workshop]));

    const data = rows.flatMap((row) => {
      const workshop = byId.get(row.id);
      return workshop
        ? [workshopJson(workshop, { publicView: true, distanceKm: row.distanceKm ?? undefined })]
        : [];
    });

    return { data, meta: { page, perPage, total } };
  }

  async getWorkshop(slug: string, lat?: number, lng?: number) {
    const workshop = await this.prisma.workshop.findFirst({
      where: { slug, status: "active" },
      include: workshopInclude,
    });
    if (!workshop) throw new ApiError("NOT_FOUND", "Workshop not found.", 404);
    return workshopJson(workshop, { publicView: true, lat, lng });
  }

  async getAvailability(workshopId: string, date: string) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(String(date ?? ""))) {
      throw new ApiError("VALIDATION_ERROR", "A date in YYYY-MM-DD format is required.", 422);
    }
    const workshop = await this.prisma.workshop.findUnique({ where: { id: workshopId } });
    if (!workshop) throw new ApiError("NOT_FOUND", "Workshop not found.", 404);

    const hours = asHours(workshop.hours);
    const closures = asClosures(workshop.closures);
    const day = new Date(`${date}T12:00:00${WIB_OFFSET}`).getUTCDay();
    const dayHours = hours.find((hour) => hour.dayOfWeek === day);
    if (!dayHours || dayHours.isClosed) return [];
    if (closures.some((closure) => closure.date === date)) return [];

    const [openH] = dayHours.openTime.split(":").map(Number);
    const [closeH] = dayHours.closeTime.split(":").map(Number);
    const slots: { time: string; iso: string; available: boolean; remaining: number }[] = [];

    for (let hour = openH; hour < closeH; hour += 1) {
      const iso = new Date(`${date}T${String(hour).padStart(2, "0")}:00:00${WIB_OFFSET}`).toISOString();
      const active = await this.prisma.serviceOrder.count({
        where: {
          workshopId,
          status: { in: ["confirmed", "in_progress"] },
          scheduledAt: {
            gte: new Date(iso),
            lt: new Date(new Date(iso).getTime() + 60 * 60 * 1000),
          },
        },
      });
      const leadTimeOk = new Date(iso).getTime() > Date.now() + 60 * 60 * 1000;
      const remaining = Math.max(0, workshop.slotCapacityPerHour - active);
      slots.push({
        time: `${String(hour).padStart(2, "0")}:00`,
        iso,
        available: remaining > 0 && leadTimeOk,
        remaining,
      });
    }
    return slots;
  }

  async listProducts(query: any) {
    const products = await this.prisma.product.findMany({
      where: {
        isActive: true,
        workshop: { status: "active" },
      },
      include: { workshop: true },
    });

    let items = products.map((product) =>
      productJson(product, {
        distanceKm:
          query.lat !== undefined && query.lng !== undefined
            ? undefined
            : undefined,
      }),
    );

    if (query.workshopId) {
      items = items.filter((product) => product.workshopId === query.workshopId);
    }
    if (query.workshopType && query.workshopType !== "all") {
      items = items.filter((product) => product.workshopType === query.workshopType);
    }
    if (query.category && query.category !== "all") {
      items = items.filter((product) => product.category === query.category);
    }
    if (query.q) {
      const q = String(query.q).toLowerCase();
      items = items.filter(
        (product) =>
          product.title.toLowerCase().includes(q) ||
          product.brand.toLowerCase().includes(q) ||
          product.workshopName.toLowerCase().includes(q),
      );
    }
    const minPrice = numberOrUndefined(query.minPrice);
    const maxPrice = numberOrUndefined(query.maxPrice);
    if (minPrice !== undefined) items = items.filter((product) => product.finalPrice >= minPrice);
    if (maxPrice !== undefined) items = items.filter((product) => product.finalPrice <= maxPrice);

    if (query.sort === "price_asc") items.sort((a, b) => a.finalPrice - b.finalPrice);
    else if (query.sort === "price_desc") items.sort((a, b) => b.finalPrice - a.finalPrice);
    else if (query.sort === "rating") items.sort((a, b) => b.ratingAvg - a.ratingAvg);
    else items.sort((a, b) => b.id.localeCompare(a.id));

    return paginate(items, numberOrUndefined(query.page), numberOrUndefined(query.perPage));
  }

  async getProduct(slug: string) {
    const product = await this.prisma.product.findUnique({ where: { slug } });
    if (!product) throw new ApiError("NOT_FOUND", "Product not found.", 404);
    return productJson(product);
  }
}
