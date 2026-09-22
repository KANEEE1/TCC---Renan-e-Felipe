import type { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";
import type { Role } from "@prisma/client";
import { HttpError } from "./http.js";

export interface AuthTokenPayload {
  sub: string;
  roles: Role[];
}

declare module "express-serve-static-core" {
  interface Request {
    auth?: AuthTokenPayload;
  }
}

function getJwtSecret() {
  const secret = process.env.JWT_SECRET;

  if (!secret) {
    throw new Error("JWT_SECRET is not set");
  }

  return secret;
}

export function signAuthToken(payload: AuthTokenPayload) {
  return jwt.sign(payload, getJwtSecret(), { expiresIn: "8h" });
}

export function requireAuth(req: Request, _res: Response, next: NextFunction) {
  const header = req.header("authorization");
  const token = header?.startsWith("Bearer ") ? header.slice("Bearer ".length) : undefined;

  if (!token) {
    throw new HttpError(401, "Missing authentication token");
  }

  try {
    req.auth = jwt.verify(token, getJwtSecret()) as AuthTokenPayload;
    next();
  } catch {
    throw new HttpError(401, "Invalid or expired token");
  }
}

export function requireRole(...roles: Role[]) {
  return (req: Request, _res: Response, next: NextFunction) => {
    if (!req.auth) {
      throw new HttpError(401, "Missing authentication token");
    }

    const hasRole = req.auth.roles.some((role) => roles.includes(role));

    if (!hasRole) {
      throw new HttpError(403, "Insufficient permissions");
    }

    next();
  };
}
