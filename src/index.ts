import config from "./config/config.js";
import { errorMiddleware } from "./middlewares/globalErrorMiddleware.js";
import authRouter from "./routes/auth.router.js";
import cookieParser from "cookie-parser";
import express, { type Express } from "express";
import morgan from "morgan";
import cors from "cors";

const createServer = (): Express => {
    const app = express();
    app
        .disable('x-powered-by')
        .use(morgan("dev"))
        .use(express.json())
        .use(express.urlencoded({ extended: true }))
        .use(cors())
        .use(cookieParser())
        .get('/health', (req, res) => {
            res.status(200).json({
                status: 'OK',
                message: 'Server is running',
            });
        })
        .get('/:name/:message', (req, res) => {
            res.status(200).json({
                status: 'OK',
                message: 'Hello ' + req.params.name + ' ' + req.params.message,
            });
        })

    return app;
}

const server = createServer();

server.use('/api/auth', authRouter);

server.use(errorMiddleware);

server.listen(config.PORT, () => {
    console.log(`Server is running on port ${config.PORT}`);
});