import { Router } from 'express';
import { register, login } from '../controllers/authController';

const router = Router();

/**
 * @swagger
 * tags:
 *   name: Auth
 *   description: User authentication endpoints
 */

// POST /api/auth/register
router.post('/register', register);

// POST /api/auth/login
router.post('/login', login);

export default router;
