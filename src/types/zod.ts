import z from "zod";

export const registerZodSchema = z.object({
    userName: z.string("UserName needs to be a proper string").trim().min(3, "Username must be at least 3 characters"),
    email: z.string().trim().email("Invalid email format"),
    password: z.string().min(8)
        .regex(/[A-Z]/, "Must include uppercase letter")
        .regex(/[0-9]/, "Must include a number"),
    confirmPassword: z.string().min(8)
}).refine(({ password, confirmPassword }) => password === confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"]
})

export const loginZodSchema = z.object({
    email: z.string().trim().email("Invalid email format"),
    password: z.string().min(8)
        .regex(/[A-Z]/, "Must include uppercase letter")
        .regex(/[0-9]/, "Must include a number"),
})

export const verifyOTPZodSchema = z.object({
    email: z.string().trim().email("Invalid email format"),
    otpHash: z.string("Must be a proper hash").trim()
})

export const resendOTPZodSchema = z.object({
    email: z.string().trim().email("Invalid email format"),
})