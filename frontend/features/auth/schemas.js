import { z } from "zod";

const email = z.string().trim().email("Enter a valid email address");

export const loginSchema = z.object({
  email,
  password: z.string().min(1, "Enter your password"),
});

export const signupSchema = z.object({
  name: z.string().trim().min(2, "Enter your full name").max(80),
  email,
  password: z.string().min(8, "Password must be at least 8 characters"),
});

export const otpSchema = z.object({
  otp: z.string().regex(/^\d{6}$/, "Enter the 6-digit verification code"),
});

