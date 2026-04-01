import dotenv from 'dotenv';
dotenv.config();


if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL is not set');
}

if (!process.env.JWT_ACCESS_SECRET) {
    throw new Error('JWT_ACCESS_SECRET is not set');
}

if (!process.env.JWT_REFRESH_SECRET) {
    throw new Error('JWT_REFRESH_SECRET is not set');
}

if (!process.env.GOOGLE_CLIENT_ID) {
    throw new Error('GOOGLE_CLIENT_ID is not set');
}

if (!process.env.GOOGLE_CLIENT_SECRET) {
    throw new Error('GOOGLE_CLIENT_SECRET is not set');
}

if (!process.env.GOOGLE_REFRESH_TOKEN) {
    throw new Error('GOOGLE_REFRESH_TOKEN is not set');
}

if (!process.env.GOOGLE_USER) {
    throw new Error('GOOGLE_USER is not set');
}


const config = {
    DATABASE_URL: process.env.DATABASE_URL!,
    PORT: process.env.PORT || 3000,
    BCRYPT_SALT: Number(process.env.BCRYPT_SALT) || 10,
    JWT_ACCESS_SECRET: process.env.JWT_ACCESS_SECRET!,
    JWT_REFRESH_SECRET: process.env.JWT_REFRESH_SECRET!,
    GOOGLE_CLIENT_ID: process.env.GOOGLE_CLIENT_ID!,
    GOOGLE_CLIENT_SECRET: process.env.GOOGLE_CLIENT_SECRET!,
    GOOGLE_REFRESH_TOKEN: process.env.GOOGLE_REFRESH_TOKEN!,
    GOOGLE_USER: process.env.GOOGLE_USER!,
}

export default config;