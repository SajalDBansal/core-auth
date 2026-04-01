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

// GET /api/auth/verify-email
authRouter.get('/verify-email', asyncHandler(authController.verifyEmail));

// GET /api/auth/forgot-password
authRouter.get('/forgot-password', asyncHandler(authController.forgotPassword));

// GET /api/auth/reset-password
authRouter.get('/reset-password', asyncHandler(authController.resetPassword));

// GET /api/auth/change-password
authRouter.get('/change-password', asyncHandler(authController.changePassword));

// GET /api/auth/delete-account
authRouter.get('/delete-account', asyncHandler(authController.deleteAccount));


export default authRouter;
