import config from "../config/config.js";
import { AuthError } from "./apiError.js";
import jwt from "jsonwebtoken";

export const verifyJWTToken = (token: string, type: "access" | "refresh" | "forget-password") => {
    try {
        let SECRET = "";

        switch (type) {
            case "access":
                SECRET = config.JWT_ACCESS_SECRET;
                break;
            case "refresh":
                SECRET = config.JWT_REFRESH_SECRET;
                break;
            case "forget-password":
                SECRET = config.JWT_FORGET_PASSWORD_SECRET;
                break;
            default:
                break;
        }

        const decoded = jwt.verify(token, SECRET);

        if (typeof decoded !== "object" || !("id" in decoded) || !("sessionId" in decoded)) {
            throw AuthError.invalidToken();
        }

        return decoded as { id: string, sessionId: string };

    } catch (err: any) {
        if (err.name === "TokenExpiredError") throw AuthError.tokenExpired();

        throw AuthError.invalidToken();
    }
};

export const normalizeEmail = (email: string) => email.trim().toLowerCase();