import config from "../config/config.js";
import { AuthError } from "./apiError.js";
import jwt from "jsonwebtoken";

export const verifyJWTToken = (token: string, type: "access" | "refresh") => {
    try {
        const decoded = jwt.verify(token, type === "access" ? config.JWT_ACCESS_SECRET : config.JWT_REFRESH_SECRET);

        if (typeof decoded !== "object" || !("id" in decoded) || !("sessionId" in decoded)) {
            throw AuthError.invalidToken();
        }

        return decoded as { id: string, sessionId: string };

    } catch (err: any) {
        if (err.name === "TokenExpiredError") throw AuthError.tokenExpired();

        throw AuthError.invalidToken();
    }
};