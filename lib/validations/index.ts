import { z } from 'zod'

// Authentication schemas
export const signInSchema = z.object({
  email: z.string().email('Invalid email address format.'),
  password: z.string().min(6, 'Password must be at least 6 characters.'),
  redirect: z.string().optional(),
})

export const signUpSchema = z.object({
  email: z.string().email('Invalid email address format.'),
  password: z.string().min(8, 'Password must be at least 8 characters.'),
  fullName: z.string().min(2, 'Full name is required.').optional(),
})

// AI Text Correction schema
export const textCorrectionSchema = z.object({
  text: z.string().min(1, 'Text content is required.').max(10000, 'Text exceeds maximum length.'),
})

// Attendance Sync schema
export const attendanceSyncSchema = z.object({
  token: z.string().min(1, 'Authentication sync token is required.'),
  records: z
    .array(
      z.object({
        user_id: z.string(),
        timestamp: z.string(),
        status: z.number().optional(),
      }),
    )
    .optional(),
})

// Dynamic Parameter Validation
export const tokenParamSchema = z.object({
  token: z.string().min(1, 'Token parameter is required.'),
})
