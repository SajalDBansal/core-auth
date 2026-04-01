export type AuthErrorCode =
    | 'AUTH_ERROR'
    | 'INVALID_TOKEN'
    | 'TOKEN_EXPIRED'
    | 'FORBIDDEN' | "TOKEN_NOT_FOUND";

export type ValidationFieldErrors = Record<string, string[]>;