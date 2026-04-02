import { Router } from "express";
import * as authController from '../controllers/auth.controller.js';
import { asyncHandler } from "../utils/asyncWrapper.js";

const authRouter = Router();

// POST /api/auth/register
authRouter.post('/register', asyncHandler(authController.register));

// POST /api/auth/login
authRouter.post('/login', asyncHandler(authController.login));

// POST /api/auth/logout
authRouter.get('/logout', asyncHandler(authController.logout));

// GET /api/auth/me
authRouter.get('/me', asyncHandler(authController.me));

// GET /api/auth/refresh
authRouter.get('/refresh', asyncHandler(authController.refresh));

//  GET /api/auth/logout-all
authRouter.get('/logout-all', asyncHandler(authController.logoutAll));

// POST /api/auth/verify-otp
authRouter.post('/verify-otp', asyncHandler(authController.verifyOTP));

// POST /api/auth/resend-otp
authRouter.post('/resend-otp', asyncHandler(authController.refreshOTP));

// POST /api/auth/forgot-password
authRouter.post('/forgot-password', asyncHandler(authController.forgotPassword));

// POST /api/auth/reset-password
authRouter.post('/reset-password', asyncHandler(authController.resetPassword));

// POST /api/auth/change-password
authRouter.post('/change-password', asyncHandler(authController.changePassword));

// POST /api/auth/delete-account
authRouter.post('/archive-account', asyncHandler(authController.archiveAccount));


export default authRouter;
