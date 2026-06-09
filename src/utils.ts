import crypto from "node:crypto";
import type { Request, Response } from "express";
import { BASE62, MAX_URL_LENGTH } from "./constants";

export function isValidDestination(rawUrl: string): boolean {
  try {
    const parsed = new URL(rawUrl);
    return ["http:", "https:"].includes(parsed.protocol) && rawUrl.length <= MAX_URL_LENGTH;
  } catch {
    return false;
  }
}

export function generateSlug(length = 6): string {
  const bytes = crypto.randomBytes(length);
  let slug = "";

  for (const byte of bytes) {
    slug += BASE62[byte % BASE62.length];
  }

  return slug;
}

export function getRequestOrigin(req: Request): string {
  const protocol = req.header("x-forwarded-proto") || "http";
  const host = req.header("x-forwarded-host") || req.header("host");
  return `${protocol}://${host}`;
}

export function requiresAdmin(req: Request, adminToken: string): boolean {
  if (!adminToken) {
    return false;
  }

  return req.header("x-admin-token") !== adminToken;
}

export function sendUnauthorized(res: Response): void {
  res.status(401).json({ error: "Missing or invalid admin token" });
}
