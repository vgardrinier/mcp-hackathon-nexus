import { config } from "dotenv";
import { z } from "zod";

config();

const envSchema = z.object({
  API_KEY: z.string().min(1, "API_KEY environment variable is required"),
  DASHBOARD_URL: z
    .string()
    .url("DASHBOARD_URL must be a valid URL")
    .min(1, "DASHBOARD_URL environment variable is required"),
  HTTP_SERVER_PORT: z
    .coerce
    .number()
    .min(1028)
    .max(49150, "HTTP_SERVER_PORT must be between 1028 and 49150")
    .default(3001),
  ALLOW_UNAUTHENTICATED_MCP: z
    .union([z.literal("true"), z.literal("false")])
    .optional()
    .transform((value) => value === "true")
});

export const env = envSchema.parse(process.env);


