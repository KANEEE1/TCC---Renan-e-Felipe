import type { NextFunction, Request, Response } from "express";
import { ZodError } from "zod";

type AsyncRouteHandler = (req: Request, res: Response, next: NextFunction) => Promise<void>;

export class HttpError extends Error {
  constructor(
    public readonly statusCode: number,
    message: string
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
    res.status(error.statusCode).json({ message: error.message });
    return;
  }

  if (error instanceof ZodError) {
    res.status(400).json({
      message: "Validation error",
      issues: error.issues
    });
    return;
  }

  console.error(error);
  res.status(500).json({ message: "Internal server error" });
}
