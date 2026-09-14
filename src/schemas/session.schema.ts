import { z } from 'zod';

export const createSessionSchema = z.object({
  classId: z.string().min(1, 'classId is required'),
  tutorId: z.string().min(1, 'tutorId is required'),
  startTime: z.string().datetime({ offset: true }).or(z.string().min(1)),
  endTime: z.string().datetime({ offset: true }).or(z.string().min(1)),
  status: z.enum(['PLANNED', 'CONFIRMED', 'COMPLETED', 'CANCELLED']).optional().default('PLANNED'),
  notes: z.string().optional().nullable(),
  attachmentUrl: z.string().optional().nullable(),
});

export const updateSessionSchema = z.object({
  startTime: z.string().optional(),
  endTime: z.string().optional(),
  status: z.enum(['PLANNED', 'CONFIRMED', 'COMPLETED', 'CANCELLED']).optional(),
  notes: z.string().optional().nullable(),
  attachmentUrl: z.string().optional().nullable(),
});

export type CreateSessionInput = z.infer<typeof createSessionSchema>;
export type UpdateSessionInput = z.infer<typeof updateSessionSchema>;
