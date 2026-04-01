import type { Request, RequestHandler, Response } from "express";
import { loginZodSchema, registerZodSchema, resendOTPZodSchema, verifyOTPZodSchema } from "../types/zod.js";
import { AuthError, ValidationError } from "../utils/apiError.js";
import { prisma } from "../prisma.js";
import bcrypt from "bcrypt";
import config from "../config/config.js";
import jwt from "jsonwebtoken";
import { verifyJWTToken } from "../utils/token-funtions.js";
import { v4 as uuidv4 } from 'uuid';
import { generateOTP, getOtpMailHtml } from "../utils/otpUtils.js";
import { sendOTPVerificationMail } from "../services/email.service.js";

export const register: RequestHandler = async (req: Request, res: Response) => {
    const body = req.body;

    const validatedData = registerZodSchema.safeParse(body)

    if (!validatedData.success) throw ValidationError.fromZod(validatedData.error);

    const { userName, email, password } = validatedData.data;

    const existingUser = await prisma.user.findUnique({ where: { email } });

    if (existingUser) throw new AuthError("User already exists", 409);

    const passwordHash = await bcrypt.hash(password, config.BCRYPT_SALT)

    const otp = generateOTP()

    const otpHash = await bcrypt.hash(otp, config.BCRYPT_SALT);
    const otpExpiry = new Date(Date.now() + 5 * 6 * 1000);

    const user = await prisma.pendingUser.upsert({
        where: { email: email.trim().toLowerCase() },
        update: {
            userName: userName.trim(),
            passwordHash,
            otpHash,
            otpExpiry
        },
        create: {
            userName: userName.trim(),
            email: email.trim().toLowerCase(),
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

    await sendOTPVerificationMail(email, "OTP Verification", `Your OTP code is ${otp}`, OTPHtml);

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

    const { email, password } = validateData.data;

    const existingUser = await prisma.user.findUnique({ where: { email: email.trim().toLowerCase() } });

    if (!existingUser) {
        const pendingUser = await prisma.pendingUser.findUnique({ where: { email } });
        if (!pendingUser) {
            throw new AuthError("Invalid credentials", 401)
        }

        throw new AuthError("User not verified yet", 401);
    }

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
        secure: true,
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

    await prisma.session.update({ where: { id: sessionId }, data: { revoke: true } });

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

    const user = await prisma.user.findFirst({
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
        secure: true,
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
        data: { revoke: true }
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

    const { email, otpHash } = validateData.data;

    const pendingUser = await prisma.pendingUser.findUnique({
        where: { email: email.trim().toLowerCase() }
    })

    if (!pendingUser) throw new AuthError("OTP expired or invalid", 401);

    if (pendingUser.otpExpiry < new Date()) throw new AuthError("OTP Expired", 401);

    const isValidOTP = bcrypt.compare(otpHash, pendingUser.otpHash);

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

    const { email } = validateData.data;

    const pendingUser = await prisma.pendingUser.findUnique({
        where: { email: email.trim().toLowerCase() },
        select: { email: true, id: true, userName: true }
    })

    if (!pendingUser) throw new AuthError("OTP expired or invalid", 401);

    const otp = generateOTP();

    const otpHash = await bcrypt.hash(otp, config.BCRYPT_SALT);
    const otpExpiry = new Date(Date.now() + 5 * 6 * 1000);

    await prisma.pendingUser.update({
        where: { email: pendingUser.email },
        data: { otpHash, otpExpiry }
    })

    const OTPHtml = getOtpMailHtml(otp);

    await sendOTPVerificationMail(email, "OTP Verification", `Your OTP code is ${otp}`, OTPHtml);

    res.status(200).json({
        success: true,
        message: "OTP resend successfully",
        user: pendingUser
    })
};

export const verifyEmail: RequestHandler = async (req: Request, res: Response) => { };

export const forgotPassword: RequestHandler = async (req: Request, res: Response) => { };

export const resetPassword: RequestHandler = async (req: Request, res: Response) => { };

export const changePassword: RequestHandler = async (req: Request, res: Response) => { };

export const deleteAccount: RequestHandler = async (req: Request, res: Response) => { };