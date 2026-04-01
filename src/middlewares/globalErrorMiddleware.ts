import { Request, Response, NextFunction } from 'express';
import { ApiError, AuthError, ValidationError } from '../utils/apiError.js';

export const errorMiddleware = (
    err: any,
    req: Request,
    res: Response,
    next: NextFunction
) => {
    let statusCode = 500;
    let message = 'Internal Server Error';
    let code = 'INTERNAL_ERROR';
    let errors = undefined;

    if (err instanceof ApiError) {
        statusCode = err.statusCode;
        message = err.message;

        if (err instanceof ValidationError) {
            code = 'VALIDATION_ERROR';
            errors = err.errors;
        }

        if ('code' in err) {
            code = err.code as string;
        }
    }

    res.status(statusCode).json({
        success: false,
        message,
        code,
        errors,
        ...(process.env.NODE_ENV === 'development' && {
            stack: err.stack,
        }),
    });
};