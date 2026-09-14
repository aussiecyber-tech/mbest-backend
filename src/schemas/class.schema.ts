import { z } from 'zod';

const VALID_SUBJECTS = [
  'Math', 'English', 'Science', 'History', 'Physics',
  'Chemistry', 'Biology', 'Geography', 'Computer Science',
  'Economics', 'Accounting', 'Literature', 'Art', 'Music'
];

const VALID_YEAR_LEVELS = [
  'Year 1', 'Year 2', 'Year 3', 'Year 4', 'Year 5', 'Year 6',
  'Year 7', 'Year 8', 'Year 9', 'Year 10', 'Year 11', 'Year 12',
  'Year 13', 'University Level'
];

export const createClassSchema = z.object({
  name: z.string().min(2, 'Class name must be at least 2 characters').max(100, 'Class name is too long'),
  subject: z.string().min(2, 'Subject must be at least 2 characters'),
  yearLevel: z.string().optional().nullable(),
  tutorId: z.string().uuid().optional().nullable().or(z.string().optional().nullable()),
  description: z.string().max(500, 'Description cannot exceed 500 characters').optional().nullable(),
  maxStudents: z.number().int().min(1, 'At least 1 student required').max(50, 'Maximum 50 students per class').optional().nullable(),
  startDate: z.string()
    .refine(val => !val || !isNaN(Date.parse(val)), { message: 'Invalid start date format' })
    .optional()
    .nullable(),
  endDate: z.string()
    .refine(val => !val || !isNaN(Date.parse(val)), { message: 'Invalid end date format' })
    .optional()
    .nullable(),
}).refine(data => {
  if (data.startDate && data.endDate) {
    return new Date(data.endDate) > new Date(data.startDate);
  }
  return true;
}, {
  message: 'End date must be after start date',
  path: ['endDate']
}).refine(data => {
  if (data.startDate) {
    return new Date(data.startDate) >= new Date(new Date().setHours(0, 0, 0, 0));
  }
  return true;
}, {
  message: 'Start date cannot be in the past',
  path: ['startDate']
});

export const updateClassSchema = z.object({
  name: z.string().min(2).max(100).optional(),
  subject: z.string().min(2).optional(),
  yearLevel: z.string().optional().nullable(),
  tutorId: z.string().optional().nullable(),
  description: z.string().max(500).optional().nullable(),
  maxStudents: z.number().int().min(1).max(50).optional().nullable(),
  startDate: z.string()
    .refine(val => !val || !isNaN(Date.parse(val)), { message: 'Invalid start date format' })
    .optional()
    .nullable(),
  endDate: z.string()
    .refine(val => !val || !isNaN(Date.parse(val)), { message: 'Invalid end date format' })
    .optional()
    .nullable(),
});

export const VALID_SUBJECTS_LIST = VALID_SUBJECTS;
export const VALID_YEAR_LEVELS_LIST = VALID_YEAR_LEVELS;

export type CreateClassInput = z.infer<typeof createClassSchema>;
export type UpdateClassInput = z.infer<typeof updateClassSchema>;
