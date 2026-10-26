import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from "@nestjs/common";
import { Prisma } from "@prisma/client";
import type { Response } from "express";
import { ApiError } from "../api-error";

@Catch()
export class ApiExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(ApiExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const response = host.switchToHttp().getResponse<Response>();

    if (exception instanceof ApiError) {
      return response.status(exception.status).json({
        error: {
          code: exception.code,
          message: exception.message,
          details: exception.details,
        },
      });
    }

    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const body = exception.getResponse();
      const message =
        typeof body === "string"
          ? body
          : (body as { message?: string | string[] }).message ?? exception.message;
      return response.status(status).json({
        error: {
          code: status === HttpStatus.NOT_FOUND ? "NOT_FOUND" : "HTTP_ERROR",
          message: Array.isArray(message) ? message.join(", ") : message,
        },
      });
    }

    if (exception instanceof Prisma.PrismaClientKnownRequestError) {
      if (exception.code === "P2002") {
        return response.status(409).json({
          error: { code: "DUPLICATE", message: "This record already exists." },
        });
      }
      if (exception.code === "P2025") {
        return response.status(404).json({
          error: { code: "NOT_FOUND", message: "Record not found." },
        });
      }
    }

    this.logger.error(exception instanceof Error ? exception.stack : String(exception));
    return response.status(500).json({
      error: {
        code: "INTERNAL_ERROR",
        message: "Something went wrong. Please try again.",
      },
    });
  }
}
