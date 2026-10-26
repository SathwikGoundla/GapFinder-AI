import { z } from "zod";

const shortText = (max: number) => z.string().trim().min(1).max(max);

/** Topic extraction: model must point each topic at chunk ids it was shown. */
export const topicMapSchema = z.object({
  topics: z.array(z.object({
    name: shortText(160),
    description: z.string().max(400).default(""),
    origin: z.enum(["syllabus", "inferred"]),
    parent: z.string().max(160).nullable().default(null),
    prerequisites: z.array(z.string().max(160)).max(6).default([]),
    source_chunk_ids: z.array(z.string()).max(12).default([]),
  })).min(1).max(40),
});
export type TopicMapOutput = z.infer<typeof topicMapSchema>;

export const generatedQuestionSchema = z.object({
  type: z.enum(["mcq", "short"]),
  difficulty: z.enum(["easy", "medium", "hard"]),
  prompt: shortText(600),
  options: z.array(shortText(240)).length(4).nullable().default(null),
  correct_option: z.number().int().min(0).max(3).nullable().default(null),
  expected_answer: shortText(800),
  evidence_chunk_id: z.string().min(1),
  evidence_quote: shortText(500),
}).superRefine((q, ctx) => {
  if (q.type === "mcq" && (q.options === null || q.correct_option === null)) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: "MCQ needs 4 options and correct_option" });
  }
  if (q.options && new Set(q.options.map((o) => o.toLowerCase())).size !== q.options.length) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: "MCQ options must be distinct" });
  }
});
export type GeneratedQuestion = z.infer<typeof generatedQuestionSchema>;

/** Questions are validated one by one so a single bad item doesn't discard the whole batch. */
export const questionBatchSchema = z.object({ questions: z.array(z.unknown()).max(10) });

export const shortAnswerEvalSchema = z.object({
  verdict: z.enum(["correct", "partial", "incorrect", "ambiguous"]),
  correct_points: z.array(z.string().max(300)).max(6).default([]),
  missing_points: z.array(z.string().max(300)).max(6).default([]),
  feedback: shortText(800),
});
export type ShortAnswerEval = z.infer<typeof shortAnswerEvalSchema>;

export const groundedAnswerSchema = z.object({
  supported: z.boolean(),
  answer: z.string().max(2500),
  claims: z.array(z.object({ text: shortText(600), chunk_id: z.string(), quote: shortText(400) })).max(8).default([]),
  inference: z.string().max(800).nullable().default(null),
});
export type GroundedAnswer = z.infer<typeof groundedAnswerSchema>;

export const sessionObjectivesSchema = z.object({
  sessions: z.array(z.object({ topic_id: z.string(), objectives: z.array(shortText(200)).min(1).max(4) })),
});
