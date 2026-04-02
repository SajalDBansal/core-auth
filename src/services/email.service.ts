import nodemailer from "nodemailer";
import config from "../config/config.js";
import { MailError } from "../utils/apiError.js";

const isMailerConfigured =
    config.GOOGLE_USER &&
    config.GOOGLE_CLIENT_ID &&
    config.GOOGLE_CLIENT_SECRET &&
    config.GOOGLE_REFRESH_TOKEN;

const transporter = isMailerConfigured
    ? nodemailer.createTransport({
        service: "gmail",
        auth: {
            type: "OAuth2",
            user: config.GOOGLE_USER,
            clientId: config.GOOGLE_CLIENT_ID,
            clientSecret: config.GOOGLE_CLIENT_SECRET,
            refreshToken: config.GOOGLE_REFRESH_TOKEN,
        },
    })
    : null;

export const verifyMailer = async () => {
    if (!isMailerConfigured || !transporter) {
        console.warn("⚠️ Mailer not configured. Skipping email service.");
        return;
    }

    try {
        await transporter.verify();
        console.log("✅ Email server is ready");
    } catch (error) {
        console.error("❌ Email server connection failed", error);
        // ❌ don't throw
    }
};

const retry = async <T>(
    fn: () => Promise<T>,
    retries = 3,
    delay = 1000
): Promise<T> => {
    try {
        return await fn();
    } catch (error) {
        if (retries <= 0) throw error;

        console.warn(`Retrying... attempts left: ${retries}`);
        await new Promise((res) => setTimeout(res, delay));
        return retry(fn, retries - 1, delay);
    }
};

export const sendEmail = async (
    to: string,
    subject: string,
    text: string,
    html: string
) => {

    if (!isMailerConfigured || !transporter) {
        console.warn("⚠️ Email not sent: mailer not configured");
        return null;
    }

    if (!to) {
        return null;
    }

    try {
        const info = await retry(() =>
            transporter.sendMail({
                from: `"Your Name" <${config.GOOGLE_USER}>`,
                to,
                subject,
                text,
                html,
            })
        );

        console.log("📨 Message sent:", info.messageId);

        return {
            success: true,
            messageId: info.messageId,
        };
    } catch (error) {
        console.error("❌ Failed to send email", error);

        throw MailError.sendFailed();
    }
};