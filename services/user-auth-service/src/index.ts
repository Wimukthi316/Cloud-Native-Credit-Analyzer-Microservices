import 'dotenv/config';
import express, { Application, Request, Response } from 'express';
import helmet from 'helmet';
import cors from 'cors';
import swaggerJsdoc from 'swagger-jsdoc';
import swaggerUi from 'swagger-ui-express';

import authRoutes from './routes/authRoutes';
import { errorHandler, notFoundHandler } from './middleware/errorHandler';

// ─── App Factory ─────────────────────────────────────────────────────────────

function createApp(): Application {
  const app = express();

  // ── Security Middleware ─────────────────────────────────────────────────
  // helmet sets a comprehensive set of security-focused HTTP response headers.
  app.use(helmet());

  // cors allows cross-origin requests; lock down 'origin' in production via env.
  app.use(
    cors({
      origin: process.env.CORS_ORIGIN ?? '*',
      methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization'],
    }),
  );

  // ── Body Parsing ────────────────────────────────────────────────────────
  app.use(express.json({ limit: '10kb' }));
  app.use(express.urlencoded({ extended: true, limit: '10kb' }));

  // ── Swagger / OpenAPI Documentation ────────────────────────────────────
  const swaggerDefinition: swaggerJsdoc.OAS3Definition = {
    openapi: '3.0.0',
    info: {
      title: 'User Auth Microservice API',
      version: '1.0.0',
      description:
        'Authentication service for the Cloud Native Credit Analyzer platform. ' +
        'Handles user registration, login, and JWT issuance.',
      contact: {
        name: 'API Support',
      },
    },
    servers: [
      {
        url: `http://localhost:${process.env.PORT ?? 3001}`,
        description: 'Local development server',
      },
    ],
    components: {
      schemas: {
        RegisterRequest: {
          type: 'object',
          required: ['email', 'password'],
          properties: {
            email: {
              type: 'string',
              format: 'email',
              example: 'alice@example.com',
            },
            password: {
              type: 'string',
              minLength: 8,
              description: 'Must be at least 8 characters.',
              example: 'SuperSecure123!',
            },
          },
        },
        LoginRequest: {
          type: 'object',
          required: ['email', 'password'],
          properties: {
            email: {
              type: 'string',
              format: 'email',
              example: 'alice@example.com',
            },
            password: {
              type: 'string',
              example: 'SuperSecure123!',
            },
          },
        },
        AuthSuccessResponse: {
          type: 'object',
          properties: {
            message: { type: 'string' },
            token: {
              type: 'string',
              description: 'Signed JWT — present only on /login',
            },
            user: {
              type: 'object',
              properties: {
                id: { type: 'string', format: 'uuid' },
                email: { type: 'string', format: 'email' },
                createdAt: { type: 'string', format: 'date-time' },
              },
            },
          },
        },
        ApiErrorResponse: {
          type: 'object',
          properties: {
            error: { type: 'string' },
            message: { type: 'string' },
            statusCode: { type: 'integer' },
          },
        },
      },
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
        },
      },
    },
  };

  const swaggerOptions: swaggerJsdoc.Options = {
    definition: swaggerDefinition,
    // Scan controller files for JSDoc @swagger annotations
    apis: ['./src/controllers/*.ts', './src/routes/*.ts'],
  };

  const swaggerSpec = swaggerJsdoc(swaggerOptions);

  app.use(
    '/api-docs',
    swaggerUi.serve,
    swaggerUi.setup(swaggerSpec, {
      customSiteTitle: 'User Auth Service — API Docs',
      swaggerOptions: { persistAuthorization: true },
    }),
  );

  // Expose raw OpenAPI JSON for tooling (Postman, code generators, etc.)
  app.get('/api-docs.json', (_req: Request, res: Response) => {
    res.setHeader('Content-Type', 'application/json');
    res.send(swaggerSpec);
  });

  // ── Health Check ────────────────────────────────────────────────────────
  /**
   * @swagger
   * /health:
   *   get:
   *     summary: Service health check
   *     tags: [Health]
   *     description: >
   *       Used by AWS ECS / load balancer health checks.
   *       Returns HTTP 200 when the service is running correctly.
   *     responses:
   *       200:
   *         description: Service is healthy
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 status:
   *                   type: string
   *                   example: ok
   *                 service:
   *                   type: string
   *                   example: user-auth-service
   *                 timestamp:
   *                   type: string
   *                   format: date-time
   */
  app.get('/health', (_req: Request, res: Response) => {
    res.status(200).json({
      status: 'ok',
      service: 'user-auth-service',
      timestamp: new Date().toISOString(),
    });
  });

  // ── API Routes ──────────────────────────────────────────────────────────
  app.use('/api/auth', authRoutes);

  // ── Fallthrough Handlers ────────────────────────────────────────────────
  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}

// ─── Bootstrap ───────────────────────────────────────────────────────────────

const PORT = parseInt(process.env.PORT ?? '3001', 10);
const app = createApp();

const server = app.listen(PORT, () => {
  console.log(`✓ user-auth-service listening on port ${PORT}`);
  console.log(`✓ API docs available at http://localhost:${PORT}/api-docs`);
  console.log(`✓ Health check at     http://localhost:${PORT}/health`);
});

// Graceful shutdown — critical for ECS task draining
process.on('SIGTERM', () => {
  console.log('SIGTERM received — shutting down gracefully...');
  server.close(() => {
    console.log('HTTP server closed.');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  console.log('SIGINT received — shutting down gracefully...');
  server.close(() => {
    console.log('HTTP server closed.');
    process.exit(0);
  });
});

export { createApp };
