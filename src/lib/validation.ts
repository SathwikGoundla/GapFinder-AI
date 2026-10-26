import { z } from "zod";
import { AppError } from "./errors";

const uuid = z.string().uuid();

export const createQuizInput = z.object({
  topicIds: z.array(uuid).min(1).max(8),
  questionsPerTopic: z.number().int().min(1).max(4).default(2),
  idempotencyKey: z.string().min(8).max(64),
});

export const submitQuizInput = z.object({
  answers: z.array(z.object({
    questionId: uuid,
    selectedOption: z.number().int().min(0).max(3).nullable().default(null),
    response: z.string().max(2000).nullable().default(null),
  })).max(40),
});

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD");
export const createPlanInput = z.object({
  examDate: isoDate,
  dailyMinutes: z.number().int().min(15).max(600),
  today: isoDate.optional(),
});

export const assistantInput = z.object({
  question: z.string().trim().min(3).max(500),
  topicId: uuid.nullable().default(null),
});

export const topicPatchInput = z.object({
  name: z.string().trim().min(1).max(160).optional(),
  parentId: uuid.nullable().optional(),
});

export const sessionPatchInput = z.object({ completed: z.boolean() });

export function parseInput<T>(schema: z.ZodType<T, z.ZodTypeDef, unknown>, data: unknown): T {
  const r = schema.safeParse(data);
  if (!r.success) {
    const first = r.error.issues[0];
    throw new AppError("VALIDATION", `Invalid input${first ? ` at "${first.path.join(".") || "body"}": ${first.message}` : ""}.`);
  }
  return r.data;
}
