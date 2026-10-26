import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import type { Request } from "express";
import { PrismaService } from "../../prisma/prisma.service";
import { ApiError } from "../api-error";
import { PUBLIC_KEY } from "./public.decorator";

export const SESSION_COOKIE = "ib_session";

@Injectable()
export class SessionGuard implements CanActivate {
  constructor(
    private readonly prisma: PrismaService,
    private readonly reflector: Reflector,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    const request = context.switchToHttp().getRequest<Request & { user?: any }>();
    const token = request.cookies?.[SESSION_COOKIE];
    if (!token) {
      if (isPublic) return true;
      throw new ApiError("UNAUTHORIZED", "Please sign in to continue.", 401);
    }

    const session = await this.prisma.session.findUnique({
      where: { id: token },
      include: { user: true },
    });

    if (!session || session.expiresAt.getTime() < Date.now()) {
      if (isPublic) return true;
      throw new ApiError("SESSION_EXPIRED", "Your session has expired. Please sign in again.", 401);
    }

    if (session.user.status === "suspended") {
      throw new ApiError("ACCOUNT_SUSPENDED", "This account is suspended.", 403);
    }

    request.user = session.user;
    return true;
  }
}
