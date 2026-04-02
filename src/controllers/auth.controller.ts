import type { Request, RequestHandler, Response } from "express";
import { archiveUserZodSchema, changePasswordZodSchema, forgetPasswordZodSchema, loginZodSchema, registerZodSchema, resendOTPZodSchema, resetPasswordZodSchema, verifyOTPZodSchema } from "../types/zod.js";
import { AuthError, ValidationError } from "../utils/apiError.js";
import { prisma } from "../prisma.js";
import bcrypt from "bcrypt";
import config from "../config/config.js";
import jwt from "jsonwebtoken";
import { normalizeEmail, verifyJWTToken } from "../utils/utils.js";
import { v4 as uuidv4 } from 'uuid';
import { generateOTP, getOtpMailHtml, getResetPasswordMailHtml } from "../utils/otpUtils.js";
import { sendEmail } from "../services/email.service.js";

export const register: RequestHandler = async (req: Request, res: Response) => {
    const body = req.body;

    const validatedData = registerZodSchema.safeParse(body)

    if (!validatedData.success) throw ValidationError.fromZod(validatedData.error);

    const { userName, email: userEmail, password } = validatedData.data;

    const email = normalizeEmail(userEmail);

    const existingUser = await prisma.user.findUnique({ where: { email } });

    if (existingUser) throw new AuthError("User already exists", 409);

    const passwordHash = await bcrypt.hash(password, config.BCRYPT_SALT)

    const otp = generateOTP()

    const otpHash = await bcrypt.hash(otp, config.BCRYPT_SALT);
    const otpExpiry = new Date(Date.now() + 5 * 60 * 1000);

    const user = await prisma.pendingUser.upsert({
        where: { email: email },
        update: {
            userName: userName.trim(),
            passwordHash,
            otpHash,
            otpExpiry
        },
        create: {
            userName: userName.trim(),
            email: email,
            passwordHash,
            otpHash,
            otpExpiry
        },
        select: {
            userName: true,
            email: true,
            id: true
        }
    });

    const OTPHtml = getOtpMailHtml(otp);

    await sendEmail(email, "OTP Verification", `Your OTP code is ${otp}`, OTPHtml);

    res.status(201).json({
        success: true,
        message: "Verification OTP sent successfully",
        user
    })
};

export const login: RequestHandler = async (req: Request, res: Response) => {
    const body = req.body;

    const validateData = loginZodSchema.safeParse(body);

    if (!validateData.success) throw ValidationError.fromZod(validateData.error);

    const { email: userEmail, password } = validateData.data;

    const email = normalizeEmail(userEmail);

    const existingUser = await prisma.user.findUnique({ where: { email: email } });

    if (!existingUser) {
        const pendingUser = await prisma.pendingUser.findUnique({ where: { email } });
        if (!pendingUser) {
            throw new AuthError("Invalid credentials", 401)
        }

        throw new AuthError("User not verified yet", 401);
    }

    if (existingUser.isArchived) throw new AuthError("Account is deactivated", 403);

    const { id: userId, userName, passwordHash } = existingUser;

    const validatePassword = await bcrypt.compare(password, passwordHash);

    if (!validatePassword) throw AuthError.unauthorized();

    const sessionId = uuidv4();

    // store in client side cookies
    const refreshToken = jwt.sign({ id: userId, sessionId }, config.JWT_REFRESH_SECRET, { expiresIn: "7d" });

    const refreshTokenHash = await bcrypt.hash(refreshToken, config.BCRYPT_SALT);

    // const deviceIP = req.ip || "";
    const deviceIP = req.headers["x-forwarded-for"]?.toString() || req.socket.remoteAddress || "";
    const userAgent = req.headers['user-agent'] || "";

    const session = await prisma.session.create({
        data: { id: sessionId, userId, refreshTokenHash, deviceIP, userAgent }
    })

    // store in client side memory
    const accessToken = jwt.sign({ id: userId, sessionId: session.id }, config.JWT_ACCESS_SECRET, { expiresIn: "15m" });

    res.cookie("refreshToken", refreshToken, {
        httpOnly: true,
        secure: config.NODE_ENV === "production",
        sameSite: "strict",
        maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
    })

    res.status(200).json({
        success: true,
        message: "User logged in successfully",
        token: `Bearer ${accessToken}`,
        user: {
            userName, email
        }
    })
};

export const logout: RequestHandler = async (req: Request, res: Response) => {
    const refreshToken = req.cookies.refreshToken as string | undefined;

    if (!refreshToken) throw AuthError.tokenNotFound();

    const { sessionId } = verifyJWTToken(refreshToken, "refresh");

    const session = await prisma.session.findUnique({
        where: { id: sessionId, revoke: false }
    })

    if (!session) throw AuthError.invalidToken();

    await prisma.session.update({ where: { id: sessionId }, data: { revoke: true, revokeAt: new Date(Date.now()) } });

    res.clearCookie("refreshToken");

    res.status(200).json({
        success: true,
        message: "User logged out successfully",
    })
};

export const me: RequestHandler = async (req: Request, res: Response) => {
    const token = req.headers.authorization?.split(" ")[1];

    if (!token) throw AuthError.tokenNotFound();

    const { id: userId } = verifyJWTToken(token, "access");

    const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { id: true, email: true, userName: true }
    })

    if (!user) throw new AuthError("User not exists", 409);

    res.status(200).json({
        success: true,
        message: "User details refetched successfully",
        user
    })
};

export const refresh: RequestHandler = async (req: Request, res: Response) => {
    const refreshToken = req.cookies.refreshToken as string | undefined;

    if (!refreshToken) throw AuthError.tokenNotFound();

    const { id: userId, sessionId } = verifyJWTToken(refreshToken, "refresh");

    const session = await prisma.session.findUnique({
        where: { id: sessionId, revoke: false }
    })

    if (!session) throw AuthError.invalidToken();

    const isValidRefreshToken = await bcrypt.compare(refreshToken, session.refreshTokenHash);

    if (!isValidRefreshToken) throw AuthError.invalidToken();

    const accessToken = jwt.sign({ id: userId, sessionId }, config.JWT_ACCESS_SECRET, { expiresIn: "15m" });

    const newRefreshToken = jwt.sign({ id: userId, sessionId }, config.JWT_REFRESH_SECRET, { expiresIn: "7d" });

    const refreshTokenHash = await bcrypt.hash(newRefreshToken, config.BCRYPT_SALT);

    await prisma.session.update({ where: { id: sessionId }, data: { refreshTokenHash } });

    res.cookie("refreshToken", newRefreshToken, {
        httpOnly: true,
        secure: config.NODE_ENV === "production",
        sameSite: "strict",
        maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
    })

    res.status(200).json({
        success: true,
        message: "Access token refreshed successfully",
        token: `Bearer ${accessToken}`,
    })
};

export const logoutAll: RequestHandler = async (req: Request, res: Response) => {
    const refreshToken = req.cookies.refreshToken as string | undefined;

    if (!refreshToken) throw AuthError.tokenNotFound();

    const { id: userId } = verifyJWTToken(refreshToken, "refresh");

    await prisma.session.updateMany({
        where: { userId, revoke: false },
        data: { revoke: true, revokeAt: new Date(Date.now()) }
    })

    res.clearCookie("refreshToken");

    res.status(200).json({
        success: true,
        message: "User logged out from all devices successfully",
    })
};

export const verifyOTP: RequestHandler = async (req: Request, res: Response) => {
    const body = req.body;

    const validateData = verifyOTPZodSchema.safeParse(body);

    if (!validateData.success) throw ValidationError.fromZod(validateData.error);

    const { email: userEmail, otp } = validateData.data;

    const email = normalizeEmail(userEmail);

    const pendingUser = await prisma.pendingUser.findUnique({
        where: { email: email }
    })

    if (!pendingUser) throw new AuthError("OTP expired or invalid", 401);

    if (pendingUser.otpExpiry < new Date()) throw new AuthError("OTP Expired", 401);

    const isValidOTP = await bcrypt.compare(otp, pendingUser.otpHash);

    if (!isValidOTP) throw new AuthError("Invalid OTP", 401);

    const user = await prisma.user.create({
        data: {
            userName: pendingUser.userName,
            passwordHash: pendingUser.passwordHash,
            email: pendingUser.email
        }, select: {
            email: true, userName: true, id: true
        }
    });

    await prisma.pendingUser.delete({ where: { email } });

    res.status(200).json({
        success: true,
        message: "User verified and registered successfully",
        user
    })
};

export const refreshOTP: RequestHandler = async (req: Request, res: Response) => {
    const body = req.body;

    const validateData = resendOTPZodSchema.safeParse(body);

    if (!validateData.success) throw ValidationError.fromZod(validateData.error);

    const { email: userEmail } = validateData.data;

    const email = normalizeEmail(userEmail);

    const pendingUser = await prisma.pendingUser.findUnique({
        where: { email: email },
        select: { email: true, id: true, userName: true }
    })

    if (!pendingUser) throw new AuthError("OTP expired or invalid", 401);

    const otp = generateOTP();

    const otpHash = await bcrypt.hash(otp, config.BCRYPT_SALT);
    const otpExpiry = new Date(Date.now() + 5 * 60 * 1000);

    await prisma.pendingUser.update({
        where: { email: pendingUser.email },
        data: { otpHash, otpExpiry }
    })

    const OTPHtml = getOtpMailHtml(otp);

    await sendEmail(email, "OTP Verification", `Your OTP code is ${otp}`, OTPHtml);

    res.status(200).json({
        success: true,
        message: "OTP resend successfully",
        user: pendingUser
    })
};

export const forgotPassword: RequestHandler = async (req: Request, res: Response) => {
    const body = req.body;

    const validateData = forgetPasswordZodSchema.safeParse(body);

    if (!validateData.success) throw ValidationError.fromZod(validateData.error);

    const { email: userEmail } = validateData.data

    const email = normalizeEmail(userEmail);

    const user = await prisma.user.findUnique({ where: { email }, select: { id: true, email: true, userName: true } });

    if (!user) {
        return res.status(201).json({
            success: true,
            message: "If the email exists, a reset link has been sent"
        })
    }

    const resetToken = await jwt.sign({ id: user.id }, config.JWT_FORGET_PASSWORD_SECRET, { expiresIn: "15m" });
    const resetTokenHash = await bcrypt.hash(resetToken, config.BCRYPT_SALT);
    const resetTokenExpiry = new Date(Date.now() + 5 * 60 * 1000);

    await prisma.user.update({
        where: { email },
        data: { passwordResetTokenHash: resetTokenHash, passwordResetTokenExpiry: resetTokenExpiry }
    })

    const resetFrontendLink = `${config.FRONTEND_URL}/reset-password?token=${resetToken}`;

    const ForgetPasswordHtml = getResetPasswordMailHtml(resetFrontendLink);

    await sendEmail(email, "Reset Password", `Click here: ${resetFrontendLink}`, ForgetPasswordHtml);

    res.status(201).json({
        success: true,
        message: "If the email exists, a reset link has been sent"
    })

};

export const resetPassword: RequestHandler = async (req: Request, res: Response) => {
    const body = req.body;

    const validateData = resetPasswordZodSchema.safeParse(body);

    if (!validateData.success) throw ValidationError.fromZod(validateData.error);

    const { email: userEmail, token, password } = validateData.data

    const email = normalizeEmail(userEmail);

    const { id: userId } = verifyJWTToken(token, "forget-password");

    const user = await prisma.user.findUnique({
        where: { id: userId, email },
        select: { passwordResetTokenHash: true, passwordResetTokenExpiry: true }
    });

    if (!user || !user.passwordResetTokenHash || !user.passwordResetTokenExpiry) throw new AuthError("Invalid credentials", 401);

    if (user.passwordResetTokenExpiry < new Date()) throw new AuthError("Link Expired", 401);

    const isValidToken = await bcrypt.compare(token, user.passwordResetTokenHash);

    if (!isValidToken) throw AuthError.invalidToken();

    const passwordHash = await bcrypt.hash(password, config.BCRYPT_SALT)

    await prisma.user.update({
        where: { id: userId },
        data: { passwordHash, passwordResetTokenHash: null }
    })

    res.status(200).json({
        success: true,
        message: "Password reset successfully"
    });
};

export const changePassword: RequestHandler = async (req: Request, res: Response) => {
    const token = req.headers.authorization?.split(" ")[1];

    if (!token) throw AuthError.tokenNotFound();

    const { id: userId } = verifyJWTToken(token, "access");

    const body = req.body;

    const validateData = changePasswordZodSchema.safeParse(body);

    if (!validateData.success) throw ValidationError.fromZod(validateData.error);

    const { email: userEmail, password, newPassword } = validateData.data;

    const email = normalizeEmail(userEmail);

    const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { passwordHash: true, userName: true }
    });

    if (!user) throw new AuthError("Invalid credentials", 401);

    const isPasswordValid = await bcrypt.compare(password, user?.passwordHash);

    if (!isPasswordValid) throw AuthError.unauthorized();

    const newPasswordHash = await bcrypt.hash(newPassword, config.BCRYPT_SALT);

    await prisma.user.update({
        where: { id: userId, email },
        data: { passwordHash: newPasswordHash }
    })

    res.status(201).json({
        success: true,
        message: "Password changed successfully",
        user: {
            email,
            id: userId,
            userName: user.userName,
        }
    })
};

export const archiveAccount: RequestHandler = async (req: Request, res: Response) => {
    const token = req.headers.authorization?.split(" ")[1];

    if (!token) throw AuthError.tokenNotFound();

    const { id: userId } = verifyJWTToken(token, "access");

    const body = req.body;

    const validateData = archiveUserZodSchema.safeParse(body);

    if (!validateData.success) throw ValidationError.fromZod(validateData.error);

    const { userName: clientUserName, password } = validateData.data;

    const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { passwordHash: true, userName: true }
    });

    if (!user || user.userName != clientUserName) throw new AuthError("Invalid credentials", 401);

    const validatePassword = await bcrypt.compare(password, user.passwordHash);

    if (!validatePassword) throw AuthError.unauthorized();

    await prisma.user.update({
        where: { id: userId },
        data: { isArchived: true, isEmailVerified: false }
    })

    await prisma.session.updateMany({
        where: { userId },
        data: { revoke: true, revokeAt: new Date(Date.now()) }
    })

    res.clearCookie("refreshToken");

    res.status(200).json({
        success: true,
        message: "User archived successfully",
    })
};