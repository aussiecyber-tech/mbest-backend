import { z } from 'zod';

const normalizeSessionInput = (value: unknown) => {
  if (!value || typeof value !== 'object') return value;
  const input = value as Record<string, unknown>;
  const date = String(input.date || '').slice(0, 10);
  const toDateTime = (camel: unknown, snake: unknown) => {
    if (camel) return camel;
    if (!date || !snake) return undefined;
    const time = String(snake).length === 5 ? `${snake}:00` : String(snake);
    return `${date}T${time}`;
  };
  const status = input.status ? String(input.status).toUpperCase() : undefined;
  return {
    ...input,
    classId: input.classId ?? input.class_id,
    tutorId: input.tutorId ?? input.teacher_id ?? input.tutor_id,
    startTime: toDateTime(input.startTime, input.start_time),
    endTime: toDateTime(input.endTime, input.end_time),
    attachmentUrl: input.attachmentUrl ?? input.attachment_url,
    status,
  };
};

export const createSessionSchema = z.preprocess(normalizeSessionInput, z.object({
  classId: z.string().min(1, 'classId is required'),
  tutorId: z.string().min(1, 'tutorId is required'),
  startTime: z.string().datetime({ offset: true }).or(z.string().min(1)),
  endTime: z.string().datetime({ offset: true }).or(z.string().min(1)),
  status: z.enum(['PLANNED', 'CONFIRMED', 'COMPLETED', 'CANCELLED']).optional().default('PLANNED'),
  notes: z.string().optional().nullable(),
  attachmentUrl: z.string().optional().nullable(),
}));

export const updateSessionSchema = z.preprocess(normalizeSessionInput, z.object({
  startTime: z.string().optional(),
  endTime: z.string().optional(),
  status: z.enum(['PLANNED', 'CONFIRMED', 'COMPLETED', 'CANCELLED']).optional(),
  notes: z.string().optional().nullable(),
  attachmentUrl: z.string().optional().nullable(),
}));

export type CreateSessionInput = z.infer<typeof createSessionSchema>;
export type UpdateSessionInput = z.infer<typeof updateSessionSchema>;
