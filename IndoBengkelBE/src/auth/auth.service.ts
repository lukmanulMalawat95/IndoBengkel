import { Injectable } from "@nestjs/common";
import * as bcrypt from "bcryptjs";
import { randomUUID } from "node:crypto";
import { PrismaService } from "../prisma/prisma.service";
import { ApiError } from "../common/api-error";
import { slugify } from "../common/ids";
import { userJson } from "../common/serializers";

const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000;

@Injectable()
export class AuthService {
  constructor(private readonly prisma: PrismaService) {}

  async login(input: { email?: string; password?: string }) {
    const email = String(input.email ?? "").trim().toLowerCase();
    const password = String(input.password ?? "");
    if (!email || !password) {
      throw new ApiError("VALIDATION_ERROR", "Email and password are required.", 422);
    }
    const user = await this.prisma.user.findUnique({ where: { email } });
    if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
      throw new ApiError("INVALID_CREDENTIALS", "Email or password is incorrect.", 401);
    }
    if (user.status === "suspended") {
      throw new ApiError("ACCOUNT_SUSPENDED", "This account is suspended.", 403);
    }
    const token = await this.createSession(user.id);
    return { user: userJson(user), token };
  }

  async registerCustomer(input: any) {
    const email = String(input.email ?? "").trim().toLowerCase();
    const fullName = String(input.fullName ?? "").trim();
    const phone = String(input.phone ?? "").trim();
    const password = String(input.password ?? "");
    if (!email || !fullName || !phone || password.length < 8) {
      throw new ApiError(
        "VALIDATION_ERROR",
        "Name, email, phone and a password of at least 8 characters are required.",
        422,
      );
    }
    await this.assertEmailAvailable(email);
    const user = await this.prisma.user.create({
      data: {
        id: `user-${randomUUID()}`,
        email,
        passwordHash: await bcrypt.hash(password, 10),
        fullName,
        phone,
        role: "customer",
        locale: "en",
        emailVerified: false,
        status: "active",
      },
    });
    const token = await this.createSession(user.id);
    return { user: userJson(user), token };
  }

  async registerWorkshop(input: any) {
    const email = String(input.email ?? "").trim().toLowerCase();
    const ownerName = String(input.ownerName ?? "").trim();
    const phone = String(input.phone ?? "").trim();
    const password = String(input.password ?? "");
    const workshopName = String(input.workshopName ?? "").trim();
    const workshopType = input.workshopType === "mobil" ? "mobil" : "motor";
    const addressLine = String(input.addressLine ?? "").trim();
    const city = String(input.city ?? "").trim();
    const province = String(input.province ?? "").trim();
    const postalCode = String(input.postalCode ?? "").trim();
    const lat = Number(input.lat);
    const lng = Number(input.lng);

    if (
      !email ||
      !ownerName ||
      !phone ||
      password.length < 8 ||
      !workshopName ||
      !addressLine ||
      !city ||
      !province ||
      !/^\d{5}$/.test(postalCode) ||
      !Number.isFinite(lat) ||
      !Number.isFinite(lng)
    ) {
      throw new ApiError("VALIDATION_ERROR", "Complete all required workshop details.", 422);
    }
    await this.assertEmailAvailable(email);

    const result = await this.prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          id: `user-${randomUUID()}`,
          email,
          passwordHash: await bcrypt.hash(password, 10),
          fullName: ownerName,
          phone,
          role: "workshop_owner",
          locale: "en",
          emailVerified: false,
          status: "active",
        },
      });

      const baseSlug = slugify(workshopName) || `workshop-${Date.now()}`;
      let slug = baseSlug;
      let suffix = 2;
      while (await tx.workshop.findUnique({ where: { slug } })) {
        slug = `${baseSlug}-${suffix}`;
        suffix += 1;
      }

      await tx.workshop.create({
        data: {
          id: `ws-${randomUUID()}`,
          ownerUserId: user.id,
          name: workshopName,
          slug,
          description: "",
          workshopType,
          phone,
          email,
          addressLine,
          city,
          province,
          postalCode,
          countryCode: "ID",
          lat,
          lng,
          timezone: "Asia/Jakarta",
          coverUrl: "",
          gallery: [],
          status: "draft",
          ratingAvg: 0,
          ratingCount: 0,
          hours: Array.from({ length: 7 }).map((_, day) => ({
            dayOfWeek: day,
            openTime: "08:00",
            closeTime: "18:00",
            isClosed: day === 0,
          })),
          closures: [],
          slotCapacityPerHour: 1,
        },
      });

      return user;
    });

    const token = await this.createSession(result.id);
    return { user: userJson(result), token };
  }

  async verifyEmail(userId: string) {
    if (!userId) throw new ApiError("VALIDATION_ERROR", "userId is required.", 422);
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new ApiError("NOT_FOUND", "User not found.", 404);
    const updated = await this.prisma.user.update({
      where: { id: userId },
      data: { emailVerified: true },
    });
    return userJson(updated);
  }

  async updateLocale(userId: string, locale: string) {
    if (!["en", "id"].includes(locale)) {
      throw new ApiError("VALIDATION_ERROR", "Unsupported locale.", 422);
    }
    const updated = await this.prisma.user.update({
      where: { id: userId },
      data: { locale },
    });
    return userJson(updated);
  }

  async me(userId: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new ApiError("NOT_FOUND", "User not found.", 404);
    return userJson(user);
  }

  async refresh(token: string) {
    const session = await this.prisma.session.findUnique({
      where: { id: token },
      include: { user: true },
    });
    if (!session) throw new ApiError("UNAUTHORIZED", "Session not found.", 401);
    await this.prisma.session.update({
      where: { id: token },
      data: { expiresAt: new Date(Date.now() + SESSION_TTL_MS) },
    });
    return userJson(session.user);
  }

  async logout(token?: string) {
    if (token) {
      await this.prisma.session.deleteMany({ where: { id: token } });
    }
    return { ok: true };
  }

  async createSession(userId: string) {
    const token = randomUUID();
    await this.prisma.session.create({
      data: {
        id: token,
        userId,
        expiresAt: new Date(Date.now() + SESSION_TTL_MS),
      },
    });
    return token;
  }

  private async assertEmailAvailable(email: string) {
    const existing = await this.prisma.user.findUnique({ where: { email } });
    if (existing) {
      throw new ApiError("EMAIL_TAKEN", "This email is already registered.", 409);
    }
  }
}
