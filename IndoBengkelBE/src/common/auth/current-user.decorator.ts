import { createParamDecorator, ExecutionContext } from "@nestjs/common";
import { ApiError } from "../api-error";

export const CurrentUser = createParamDecorator(
  (_data: unknown, context: ExecutionContext) => {
    const request = context.switchToHttp().getRequest<{ user?: any }>();
    if (!request.user) {
      throw new ApiError("UNAUTHORIZED", "Please sign in to continue.", 401);
    }
    return request.user;
  },
);
