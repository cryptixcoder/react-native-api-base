import { Router } from 'express';
import { asyncHandler } from '@/middleware/async-handler.js';
import { requireAuth } from '@/middleware/auth.middleware.js';
import { passwordResetRateLimiter } from '@/middleware/rate-limit.middleware.js';
import { validate } from '@/middleware/validate.js';
import * as authController from '@/modules/auth/auth.controller.js';
import { emailOnlySchema, loginSchema, refreshTokenSchema, registerSchema, resetPasswordSchema, verifyEmailSchema } from '@/modules/auth/auth.schema.js';

export const authRouter = Router();

authRouter.post('/register', validate({ body: registerSchema }), asyncHandler(authController.register));
authRouter.post('/login', validate({ body: loginSchema }), asyncHandler(authController.login));
authRouter.post('/refresh', validate({ body: refreshTokenSchema }), asyncHandler(authController.refresh));
authRouter.post('/logout', validate({ body: refreshTokenSchema }), asyncHandler(authController.logout));
authRouter.post('/logout-all', requireAuth, asyncHandler(authController.logoutAll));
authRouter.get('/me', requireAuth, asyncHandler(authController.me));
authRouter.post('/forgot-password', passwordResetRateLimiter, validate({ body: emailOnlySchema }), asyncHandler(authController.forgotPassword));
authRouter.post('/reset-password', validate({ body: resetPasswordSchema }), asyncHandler(authController.resetPassword));
authRouter.post('/verify-email', validate({ body: verifyEmailSchema }), asyncHandler(authController.verifyEmail));
authRouter.post('/resend-verification', passwordResetRateLimiter, validate({ body: emailOnlySchema }), asyncHandler(authController.resendVerification));
