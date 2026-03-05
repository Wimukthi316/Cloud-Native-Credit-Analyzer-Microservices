import { Request, Response, NextFunction } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';
import {
  User,
  RegisterRequestBody,
  LoginRequestBody,
  AuthSuccessResponse,
  ApiErrorResponse,
} from '../types';

// ─── In-Memory Store (Replace with ORM / DB later) ───────────────────────────
// This array acts as a lightweight mock database.
// All data is ephemeral and will be lost on process restart.
const userStore: User[] = [];

const BCRYPT_SALT_ROUNDS = 12;

// ─── Helpers ─────────────────────────────────────────────────────────────────

const getJwtSecret = (): string => {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error('JWT_SECRET environment variable is not set.');
  return secret;
};

const getJwtExpiresIn = (): string =>
  process.env.JWT_EXPIRES_IN ?? '1h';

// ─── Controllers ─────────────────────────────────────────────────────────────

/**
 * @swagger
 * /api/auth/register:
 *   post:
 *     summary: Register a new user
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/RegisterRequest'
 *     responses:
 *       201:
 *         description: User registered successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/AuthSuccessResponse'
 *       400:
 *         description: Validation error or missing fields
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ApiErrorResponse'
 *       409:
 *         description: Email is already registered
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ApiErrorResponse'
 */
export const register = async (
  req: Request<object, object, RegisterRequestBody>,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const { email, password } = req.body;

    // ── Input validation ──────────────────────────────────────────────────
    if (!email || !password) {
      const body: ApiErrorResponse = {
        error: 'ValidationError',
        message: 'Both "email" and "password" fields are required.',
        statusCode: 400,
      };
      res.status(400).json(body);
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      const body: ApiErrorResponse = {
        error: 'ValidationError',
        message: 'Please provide a valid email address.',
        statusCode: 400,
      };
      res.status(400).json(body);
      return;
    }

    if (password.length < 8) {
      const body: ApiErrorResponse = {
        error: 'ValidationError',
        message: 'Password must be at least 8 characters long.',
        statusCode: 400,
      };
      res.status(400).json(body);
      return;
    }

    // ── Duplicate check ───────────────────────────────────────────────────
    const existingUser = userStore.find(
      (u) => u.email.toLowerCase() === email.toLowerCase(),
    );
    if (existingUser) {
      const body: ApiErrorResponse = {
        error: 'Conflict',
        message: 'An account with this email address already exists.',
        statusCode: 409,
      };
      res.status(409).json(body);
      return;
    }

    // ── Hash & persist ────────────────────────────────────────────────────
    const passwordHash = await bcrypt.hash(password, BCRYPT_SALT_ROUNDS);

    const newUser: User = {
      id: uuidv4(),
      email: email.toLowerCase().trim(),
      passwordHash,
      createdAt: new Date().toISOString(),
    };

    userStore.push(newUser);

    // Never expose the password hash in responses
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { passwordHash: _omit, ...safeUser } = newUser;

    const body: AuthSuccessResponse = {
      message: 'User registered successfully.',
      user: safeUser,
    };

    res.status(201).json(body);
  } catch (err) {
    next(err);
  }
};

/**
 * @swagger
 * /api/auth/login:
 *   post:
 *     summary: Authenticate a user and return a JWT
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/LoginRequest'
 *     responses:
 *       200:
 *         description: Login successful — JWT token returned
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/AuthSuccessResponse'
 *       400:
 *         description: Missing fields
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ApiErrorResponse'
 *       401:
 *         description: Invalid credentials
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ApiErrorResponse'
 */
export const login = async (
  req: Request<object, object, LoginRequestBody>,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const { email, password } = req.body;

    // ── Input validation ──────────────────────────────────────────────────
    if (!email || !password) {
      const body: ApiErrorResponse = {
        error: 'ValidationError',
        message: 'Both "email" and "password" fields are required.',
        statusCode: 400,
      };
      res.status(400).json(body);
      return;
    }

    // ── Look up user ──────────────────────────────────────────────────────
    const user = userStore.find(
      (u) => u.email.toLowerCase() === email.toLowerCase(),
    );

    // Constant-time comparison even on "not found" path to prevent
    // user-enumeration via timing attacks.
    const passwordToCompare = user?.passwordHash ?? '$2a$12$invalidhashpadding000000000000000';
    const isPasswordValid = await bcrypt.compare(password, passwordToCompare);

    if (!user || !isPasswordValid) {
      const body: ApiErrorResponse = {
        error: 'Unauthorized',
        message: 'Invalid email address or password.',
        statusCode: 401,
      };
      res.status(401).json(body);
      return;
    }

    // ── Sign JWT ──────────────────────────────────────────────────────────
    const token = jwt.sign(
      { sub: user.id, email: user.email },
      getJwtSecret(),
      { expiresIn: getJwtExpiresIn() } as jwt.SignOptions,
    );

    const { passwordHash: _omit, ...safeUser } = user;

    const body: AuthSuccessResponse = {
      message: 'Login successful.',
      token,
      user: safeUser,
    };

    res.status(200).json(body);
  } catch (err) {
    next(err);
  }
};
