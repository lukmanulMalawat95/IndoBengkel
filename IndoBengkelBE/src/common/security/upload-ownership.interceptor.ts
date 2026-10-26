import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from "@nestjs/common";
import { Observable } from "rxjs";
import { UploadsService } from "../../uploads/uploads.service";

const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

/**
 * Every authenticated mutation is scanned for `/api/uploads/...` references.
 * The upload route records the owner, so a signed-in user cannot attach a file
 * another account uploaded. External image URLs are unaffected.
 */
@Injectable()
export class UploadOwnershipInterceptor implements NestInterceptor {
  constructor(private readonly uploads: UploadsService) {}

  async intercept(context: ExecutionContext, next: CallHandler): Promise<Observable<unknown>> {
    const request = context.switchToHttp().getRequest();
    if (
      !SAFE_METHODS.has(request.method) &&
      request.user?.id &&
      request.body &&
      typeof request.body === "object"
    ) {
      await this.uploads.assertOwned(request.user.id, request.body);
    }
    return next.handle();
  }
}
