import config from "./config/config.js";
import { errorMiddleware } from "./middlewares/globalErrorMiddleware.js";
import authRouter from "./routes/auth.router.js";
import cookieParser from "cookie-parser";
import express, { type Express } from "express";
import morgan from "morgan";
import cors from "cors";
import path from "path";

const createServer = (): Express => {
    const app = express();
    app
        .disable('x-powered-by')
        .set('views', path.join(process.cwd(), 'src/views'))
        .set('view engine', 'ejs')
        .use(morgan("dev"))
        .use(express.json())
        .use(express.urlencoded({ extended: true }))
        .use(express.static(path.join(process.cwd(), 'src/public')))
        .use(cors())
        .use(cookieParser())
        .get('/', (req, res) => {
            const hostUrl = req.protocol + "://" + req.headers.host;

            res.render('home', {
                url: req.protocol + "://" + req.headers.host,
                githubUrl: config.GITHUB_URL
            })
        })

        .get('/endpoints', (req, res) => {
            const hostUrl = req.protocol + "://" + req.headers.host;

            res.render('endpoints', {
                url: hostUrl,
                githubUrl: config.GITHUB_URL,
                requestedUrl: req.originalUrl
            });
        })

        .get('/tokens', (req, res) => {
            const hostUrl = req.protocol + "://" + req.headers.host;

            res.render('tokens', {
                url: hostUrl,
                githubUrl: config.GITHUB_URL,
                requestedUrl: req.originalUrl
            });
        })

        .get('/health', (req, res) => {
            res.status(200).json({
                status: 'OK',
                message: 'Server is running',
            });
        });

    return app;
}

const server = createServer();

server.use('/api/auth', authRouter);

server.use((req, res) => {
    const routes = [
        { method: "POST", path: "/api/auth/register" },
        { method: "POST", path: "/api/auth/login" },
        { method: "GET", path: "/api/auth/logout" },
        { method: "GET", path: "/api/auth/logout-all" },
        { method: "GET", path: "/api/auth/me" },
        { method: "GET", path: "/api/auth/refresh" },
        { method: "POST", path: "/api/auth/verify-otp" },
        { method: "POST", path: "/api/auth/resend-otp" },
        { method: "POST", path: "/api/auth/forgot-password" },
        { method: "POST", path: "/api/auth/reset-password" },
        { method: "POST", path: "/api/auth/change-password" },
        { method: "POST", path: "/api/auth/archive-account" },
        { method: "GET", path: "/health" }
    ];

    if (req.accepts("html")) {
        const hostUrl = req.protocol + "://" + req.headers.host;

        return res.status(404).render('notFound', {
            url: hostUrl,
            routes,
            githubUrl: config.GITHUB_URL,
            requestedUrl: req.originalUrl
        });
    }

    return res.status(404).json({
        success: false,
        message: "Route not found",
        path: req.originalUrl,
        availableRoutes: routes
    });
});

server.use(errorMiddleware);

// use server listen in your code
// server.listen(config.PORT, () => {
//     console.log(`Server is running on port ${config.PORT}`);
// });

export default server;