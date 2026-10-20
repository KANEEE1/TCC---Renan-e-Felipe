import { Prisma } from "@prisma/client";
import type { NextFunction, Request, Response } from "express";
import { ZodError } from "zod";

const PRISMA_ERROR_STATUS: Record<string, { status: number; message: string }> = {
  P2002: { status: 409, message: "Resource already exists" },
  P2003: { status: 400, message: "Referenced resource does not exist" },
  P2025: { status: 404, message: "Resource not found" },
  P2034: { status: 409, message: "Concurrent update conflict, please retry" }
};

type AsyncRouteHandler = (req: Request, res: Response, next: NextFunction) => Promise<void>;

export class HttpError extends Error {
  constructor(
    public readonly statusCode: number,
    message: string,
    public readonly details?: Record<string, unknown>
  ) {
    super(message);
  }
}

export function asyncHandler(handler: AsyncRouteHandler) {
  return (req: Request, res: Response, next: NextFunction) => {
    void handler(req, res, next).catch(next);
  };
}

export function errorHandler(error: unknown, _req: Request, res: Response, _next: NextFunction) {
  if (error instanceof HttpError) {
    res.status(error.statusCode).json({ ...error.details, message: error.message });
    return;
  }

  if (error instanceof ZodError) {
    res.status(400).json({
      message: "Validation error",
      issues: error.issues
    });
    return;
  }

  if (error instanceof Prisma.PrismaClientKnownRequestError && PRISMA_ERROR_STATUS[error.code]) {
    const { status, message } = PRISMA_ERROR_STATUS[error.code];
    res.status(status).json({ message });
    return;
  }

  console.error(error);
  res.status(500).json({ message: "Internal server error" });
}
