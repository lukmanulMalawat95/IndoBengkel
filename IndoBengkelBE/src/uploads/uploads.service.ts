import { Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { ApiError } from "../common/api-error";
import { uid } from "../common/ids";

const MAX_BYTES = 5 * 1024 * 1024;

const MIME_EXTENSION: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

/** Matches the names produced by the web upload route. */
const NAME_PATTERN = /^[a-z0-9][a-z0-9-]*\.(jpg|png|webp)$/;

/** A reference to a locally uploaded file, e.g. `/api/uploads/abc-123.png`. */
const UPLOAD_URL = /^\/api\/uploads\/([a-z0-9][a-z0-9-]*\.(?:jpg|png|webp))$/;

@Injectable()
export class UploadsService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Record the owner of a file the web tier has already written to disk. The
   * bytes never reach this service; the session proves who uploaded them.
   */
  async register(userId: string, input: any) {
    const name = String(input?.name ?? "");
    const mimeType = String(input?.mimeType ?? "");
    const size = Number(input?.size);
    const extension = MIME_EXTENSION[mimeType];

    if (!extension || !NAME_PATTERN.test(name) || !name.endsWith(`.${extension}`)) {
      throw new ApiError("VALIDATION_ERROR", "Upload metadata is invalid.", 422);
    }
    if (!Number.isInteger(size) || size <= 0 || size > MAX_BYTES) {
      throw new ApiError("VALIDATION_ERROR", "Upload size is invalid.", 422);
    }

    const existing = await this.prisma.upload.findUnique({ where: { name } });
    if (existing) {
      if (existing.ownerUserId !== userId) {
        throw new ApiError("UPLOAD_CONFLICT", "That file name is already registered.", 409);
      }
      return this.uploadJson(existing);
    }

    const upload = await this.prisma.upload.create({
      data: { id: uid("upl"), name, ownerUserId: userId, mimeType, size },
    });
    return this.uploadJson(upload);
  }

  /**
   * Reject references to `/api/uploads/...` files the caller did not upload.
   * External URLs and data URIs are left alone; only our own storage is
   * ownership-checked.
   */
  async assertOwned(userId: string, value: unknown) {
    const names = new Set<string>();
    const visit = (node: unknown) => {
      if (typeof node === "string") {
        const match = UPLOAD_URL.exec(node);
        if (match) names.add(match[1]);
        return;
      }
      if (Array.isArray(node)) {
        node.forEach(visit);
        return;
      }
      if (node && typeof node === "object") {
        Object.values(node as Record<string, unknown>).forEach(visit);
      }
    };
    visit(value);
    if (names.size === 0) return;

    const rows = await this.prisma.upload.findMany({
      where: { name: { in: [...names] } },
    });
    const owned = new Set(
      rows.filter((row) => row.ownerUserId === userId).map((row) => row.name),
    );
    for (const name of names) {
      if (!owned.has(name)) {
        throw new ApiError("UPLOAD_NOT_OWNED", "That image does not belong to you.", 403);
      }
    }
  }

  private uploadJson(upload: {
    id: string;
    name: string;
    mimeType: string;
    size: number;
    createdAt: Date;
  }) {
    return {
      id: upload.id,
      name: upload.name,
      url: `/api/uploads/${upload.name}`,
      mimeType: upload.mimeType,
      size: upload.size,
      createdAt: upload.createdAt,
    };
  }
}
