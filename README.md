# About Core Auth

Core Auth is a production-ready authentication service that provides:

- JWT-based access and refresh tokens
- Secure refresh token rotation
- Blacklist-style invalidation (revoked sessions)
- OTP-based authentication (OTP verification, resend OTP)
- Safe logout handling (single-session logout + logout-all)
- Password reset and account archive flows

The server is built with Express and uses Prisma + PostgreSQL for persistence of users and refresh-token sessions.

## How Tokens Work (Quick Overview)

- `access token` (JWT): short-lived token (15m) returned in the response body as `Bearer <token>`.
- `refresh token` (JWT): long-lived token (7d) stored in an `httpOnly` cookie named `refreshToken`.
- Refresh token rotation:
  - On `/api/auth/refresh`, the server issues a new refresh token and updates the session with a new hashed refresh token.
- Logout / invalidation:
  - `/api/auth/logout` revokes the current session (`revoke: true`) and clears the `refreshToken` cookie.
  - `/api/auth/logout-all` revokes all sessions for the authenticated user and clears the cookie.

## API Routes

Base path: `/api/auth`

| Method | Route | Auth / Cookies | What it does |
|---|---|---|---|
| `POST` | `/register` | none | Creates a pending user and sends an OTP to verify the email |
| `POST` | `/login` | none | Validates credentials, creates a session, sets `refreshToken` cookie, returns `token` (Bearer access token) |
| `GET` | `/logout` | `refreshToken` cookie | Revokes the current refresh session and clears the cookie |
| `GET` | `/me` | `Authorization: Bearer <access>` | Returns the authenticated user profile (`id`, `email`, `userName`) |
| `GET` | `/refresh` | `refreshToken` cookie | Rotates refresh token and returns a new access token |
| `GET` | `/logout-all` | `refreshToken` cookie | Revokes all user sessions and clears the cookie |
| `POST` | `/verify-otp` | none | Verifies OTP for a pending user and creates the real user account |
| `POST` | `/resend-otp` | none | Resends a new OTP for an email that is pending verification |
| `POST` | `/forgot-password` | none | Sends a password reset link/token (always returns a generic success message) |
| `POST` | `/reset-password` | none | Validates the reset token and sets a new password |
| `POST` | `/change-password` | `Authorization: Bearer <access>` | Changes password for the authenticated user |
| `POST` | `/archive-account` | `Authorization: Bearer <access>` | Archives/deactivates the account and revokes active sessions |

### Payloads (request bodies)

- `/register`:
  - `{ "userName": string, "email": string, "password": string, "confirmPassword": string }`
- `/login`:
  - `{ "email": string, "password": string }`
- `/verify-otp`:
  - `{ "email": string, "otp": string }`
- `/resend-otp`:
  - `{ "email": string }`
- `/forgot-password`:
  - `{ "email": string }`
- `/reset-password`:
  - `{ "email": string, "token": string, "password": string, "confirmPassword": string }`
- `/change-password`:
  - `{ "email": string, "password": string, "newPassword": string, "confirmPassword": string }`
- `/archive-account`:
  - `{ "userName": string, "password": string }`

## Clone and Run Locally

1. Clone the repo:
   - `git clone https://github.com/<YOUR_ORG_OR_USER>/core-auth.git`
2. Install dependencies:
   - `npm install`
3. Configure environment variables:
   - Copy `.env.example` to `.env`
   - Ensure you set the required variables used by `src/config/config.ts`, including:
     - `DATABASE_URL`
     - `FRONTEND_URL`
     - `PORT` (optional)
     - `BCRYPT_SALT` (optional)
     - `JWT_ACCESS_SECRET`
     - `JWT_REFRESH_SECRET`
     - `JWT_FORGET_PASSWORD_SECRET`
     - `GOOGLE_CLIENT_ID`
     - `GOOGLE_CLIENT_SECRET`
     - `GOOGLE_REFRESH_TOKEN`
     - `GOOGLE_USER`
4. Create/update the database schema:
   - Start Postgres using Docker Compose:
     - `docker compose up -d db`
   - Generate Prisma client:
     - `npx prisma generate`
   - Apply migrations:
     - `npx prisma migrate dev`
5. Start the dev server:
   - `npm run dev`

Health check endpoint:

- `GET /health`

## Using It From Your Code

### 1) Register

```bash
curl -X POST "http://localhost:3000/api/auth/register" \
  -H "Content-Type: application/json" \
  -d '{"userName":"alice","email":"alice@example.com","password":"Password123","confirmPassword":"Password123"}'
```

This sends an OTP to the provided email (OTP is stored hashed server-side).

### 2) Verify OTP

```bash
curl -X POST "http://localhost:3000/api/auth/verify-otp" \
  -H "Content-Type: application/json" \
  -d '{"email":"alice@example.com","otp":"<OTP_CODE>"}'
```

### 3) Login (receives access token + refresh cookie)

```bash
curl -X POST "http://localhost:3000/api/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"email":"alice@example.com","password":"Password123"}'
```

The response includes:

- `token`: `Bearer <accessToken>`
- the server sets an `httpOnly` cookie: `refreshToken`

### 4) Call a protected route (`/me`)

```bash
curl -X GET "http://localhost:3000/api/auth/me" \
  -H "Authorization: Bearer <accessToken>"
```

### 5) Refresh tokens (refresh cookie required)

If you’re using a browser or `fetch`, ensure cookies are included:

```js
await fetch("http://localhost:3000/api/auth/refresh", {
  method: "GET",
  credentials: "include"
});
```

### 6) Logout / Logout all

```bash
curl -X GET "http://localhost:3000/api/auth/logout"
```

and

```bash
curl -X GET "http://localhost:3000/api/auth/logout-all"
```

For these to work, the `refreshToken` cookie must be present.

### Integrate `authRouter` into your Express app

If you want to reuse the router directly (rather than running the server as a standalone service), mount it like this:

```ts
import express from "express";
import authRouter from "./src/routes/auth.router.js";

const app = express();
app.use(express.json());

app.use("/api/auth", authRouter);

app.listen(3000);
```
