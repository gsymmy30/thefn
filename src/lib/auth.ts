import { createHash, randomBytes } from "node:crypto";
import { createSession, getSessionUserByTokenHash } from "@/lib/db";

export const SESSION_COOKIE_NAME = "session_token";
export const SESSION_TTL_SECONDS = 60 * 60 * 24 * 7;

export function normalizePhone(rawPhone: string) {
  const digits = rawPhone.replace(/\D/g, "");
  if (digits.length === 10) {
    return `+1${digits}`;
  }
  if (digits.length === 11 && digits.startsWith("1")) {
    return `+${digits}`;
  }
  return null;
}

export function normalizeEmail(rawEmail: string) {
  return rawEmail.trim().toLowerCase();
}

export function isValidEmail(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export function generateSessionToken() {
  return randomBytes(32).toString("base64url");
}

export function hashToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export function createSessionForUser(params: {
  userId: string;
  ipAddress?: string | null;
  userAgent?: string | null;
}) {
  const token = generateSessionToken();
  createSession({
    userId: params.userId,
    tokenHash: hashToken(token),
    ttlSeconds: SESSION_TTL_SECONDS,
    ipAddress: params.ipAddress,
    userAgent: params.userAgent,
  });
  return token;
}

export function getAuthenticatedUserFromToken(token?: string | null) {
  if (!token) {
    return null;
  }
  return getSessionUserByTokenHash(hashToken(token));
}

export function getClientIp(forwardedFor: string | null) {
  if (!forwardedFor) {
    return null;
  }
  const first = forwardedFor.split(",")[0]?.trim();
  return first || null;
}
