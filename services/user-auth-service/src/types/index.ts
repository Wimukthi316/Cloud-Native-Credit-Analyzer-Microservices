/**
 * Shared domain types for the User Auth Microservice.
 */

// ─── User ────────────────────────────────────────────────────────────────────

export interface User {
  id: string;
  email: string;
  /** bcrypt-hashed password — never expose this in responses */
  passwordHash: string;
  createdAt: string; // ISO-8601
}

// ─── Request / Response DTOs ─────────────────────────────────────────────────

export interface RegisterRequestBody {
  email: string;
  password: string;
}

export interface LoginRequestBody {
  email: string;
  password: string;
}

export interface AuthSuccessResponse {
  message: string;
  token?: string;
  user?: Omit<User, 'passwordHash'>;
}

// ─── JWT ─────────────────────────────────────────────────────────────────────

export interface JwtPayload {
  sub: string;  // user id
  email: string;
  iat?: number;
  exp?: number;
}

// ─── Generic API responses ───────────────────────────────────────────────────

export interface ApiErrorResponse {
  error: string;
  message: string;
  statusCode: number;
}
