import { z } from 'zod'

const envSchema = z.object({
  // Public variables (accessible in browser)
  NEXT_PUBLIC_SUPABASE_URL: z.string().url(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1),

  // Server-only secrets
  SUPABASE_URL: z.string().url().optional(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1).optional(),
  DGM_EMAIL: z.string().email().optional().default('tarikuj25@gmail.com'),

  // Email & Resend
  RESEND_API_KEY: z.string().optional(),
  SMTP_HOST: z.string().optional(),
  SMTP_PORT: z.string().optional(),
  SMTP_USER: z.string().optional(),
  SMTP_PASSWORD: z.string().optional(),
  SMTP_FROM_EMAIL: z.string().optional(),
  SMTP_FROM_NAME: z.string().optional(),
  REMINDER_RECIPIENTS: z.string().optional(),
  REMINDER_FROM: z.string().optional(),

  // Cron & Integration Secrets
  CRON_SECRET: z.string().optional(),
  INTERNAL_SYNC_TOKEN: z.string().optional(),

  // AI & Services
  GEMINI_API_KEY: z.string().optional(),
  OLLAMA_BASE_URL: z.string().optional(),
  OLLAMA_MODEL: z.string().optional(),

  // Environment mode
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
})

/**
 * Validates process.env against the Zod schema.
 * Throws a formatted descriptive error at startup if validation fails.
 */
function parseEnv() {
  const result = envSchema.safeParse(process.env)

  if (!result.success) {
    console.error(
      '❌ Invalid environment variables detected:',
      JSON.stringify(result.error.format(), null, 2),
    )
    throw new Error('Environment variable validation failed. See logs above.')
  }

  return result.data
}

export const env = parseEnv()
