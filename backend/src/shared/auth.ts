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

// Token de uso único e propósito específico (confirmação de e-mail, redefinição de senha),
// separado do token de sessão para que nunca possa ser usado pra autenticar como o usuário.
export function signPurposeToken(purpose: string, userId: string, expiresIn: string) {
  return jwt.sign({ purpose, sub: userId }, getJwtSecret(), { expiresIn } as jwt.SignOptions);
}

export function verifyPurposeToken(purpose: string, token: string): string {
  let payload: jwt.JwtPayload | string;

  try {
    payload = jwt.verify(token, getJwtSecret());
  } catch {
    throw new HttpError(400, "Link inválido ou expirado");
  }

  if (typeof payload === "string" || payload.purpose !== purpose || typeof payload.sub !== "string") {
    throw new HttpError(400, "Link inválido ou expirado");
  }

  return payload.sub;
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

export interface Actor {
  id: string;
  roles: Role[];
}

export function getActor(req: Request): Actor {
  if (!req.auth) {
    throw new HttpError(401, "Missing authentication token");
  }

  return { id: req.auth.sub, roles: req.auth.roles };
}

export function hasRole(actor: Pick<Actor, "roles">, ...roles: Role[]) {
  return actor.roles.some((role) => roles.includes(role));
}

export function requireRole(...roles: Role[]) {
  return (req: Request, _res: Response, next: NextFunction) => {
    if (!req.auth) {
      throw new HttpError(401, "Missing authentication token");
    }

    if (!hasRole(req.auth, ...roles)) {
      throw new HttpError(403, "Insufficient permissions");
    }

    next();
  };
}
