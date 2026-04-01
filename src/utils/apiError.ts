import { AuthErrorCode, ValidationFieldErrors } from "../types/types.js";

export class ApiError extends Error {
    statusCode: number;

    constructor(statusCode: number, message: string) {
        super(message);

        this.statusCode = statusCode;
        this.name = 'ApiError';

        Object.setPrototypeOf(this, new.target.prototype);
        Error.captureStackTrace(this, this.constructor);
    }
}

export class AuthError extends ApiError {
    code: AuthErrorCode;

    constructor(
        message = 'Unauthorized',
        statusCode: 401 | 403 | 404 | 409 = 401,
        code: AuthErrorCode = 'AUTH_ERROR'
    ) {
        super(statusCode, message);

        this.name = 'AuthError';
        this.code = code;

        Object.setPrototypeOf(this, new.target.prototype);
    }

    static unauthorized(message = 'Unauthorized') {
        return new AuthError(message, 401, 'AUTH_ERROR');
    }

    static invalidToken(message = 'Invalid token') {
        return new AuthError(message, 401, 'INVALID_TOKEN');
    }

    static tokenNotFound(message = 'Token not found') {
        return new AuthError(message, 401, 'TOKEN_NOT_FOUND');
    }

    static tokenExpired(message = 'Token expired') {
        return new AuthError(message, 401, 'TOKEN_EXPIRED');
    }

    static forbidden(message = 'Forbidden') {
        return new AuthError(message, 403, 'FORBIDDEN');
    }
}

export class ValidationError extends ApiError {
    errors: ValidationFieldErrors;

    constructor(
        message = 'Validation failed',
        errors: ValidationFieldErrors = {}
    ) {
        super(400, message);

        this.name = 'ValidationError';
        this.errors = errors;

        Object.setPrototypeOf(this, new.target.prototype);
    }

    // 🔥 Helper for Zod
    static fromZod(error: any) {
        const fieldErrors = error.flatten().fieldErrors;

        return new ValidationError('Validation failed', fieldErrors);
    }
}