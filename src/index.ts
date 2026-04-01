import config from "./config/config.js";
import { errorMiddleware } from "./middlewares/globalErrorMiddleware.js";
import authRouter from "./routes/auth.router.js";
import { createServer } from "./server.js";

const server = createServer();

server.use('/api/auth', authRouter);

server.use(errorMiddleware);

server.listen(config.PORT, () => {
    console.log(`Server is running on port ${config.PORT}`);
});