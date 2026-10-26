/**
 * Prompt builders. Evidence is passed as tagged blocks with ids so the model can cite them,
 * and the application verifies every cited id afterwards (see rag/citations.ts).
 */
export interface EvidenceBlock { id: string; label: string; content: string }

export function formatEvidence(blocks: EvidenceBlock[]): string {
  return blocks.map((b) => `<evidence id="${b.id}" source="${b.label.replace(/"/g, "'")}">\n${b.content}\n</evidence>`).join("\n\n");
}

export const TOPIC_MAP_SYSTEM = `You build a study topic map from a student's course materials.
Rules:
- Use origin "syllabus" ONLY for topics explicitly listed in evidence whose source is a syllabus. Everything else is "inferred".
- Keep names short (2-6 words). Use "parent" for subtopics (the parent's exact name) and null for top-level topics.
- "prerequisites" lists names of other topics in your output that should be understood first. Only include clear dependencies.
- "source_chunk_ids" must contain ids of evidence blocks that actually discuss the topic. Never invent ids.
Output: {"topics":[{"name","description","origin","parent","prerequisites","source_chunk_ids"}]}`;

export const QUESTION_SYSTEM = `You write diagnostic questions that reveal whether a student understands a topic.
Rules:
- Every question must be answerable ONLY from one evidence block. Set evidence_chunk_id to that block's id.
- evidence_quote must be copied word-for-word from that block (one or two sentences that justify the answer).
- Prefer questions that test understanding (why, how, compare, apply) over trivia.
- MCQ: exactly 4 distinct, plausible options; correct_option is the 0-based index. options null for short answers.
- Short answers: expected_answer lists the key points a complete answer must contain.
- If the evidence is too thin for a good question, return fewer questions. Never use outside knowledge.
Output: {"questions":[{"type","difficulty","prompt","options","correct_option","expected_answer","evidence_chunk_id","evidence_quote"}]}`;

export const EVALUATE_SYSTEM = `You grade a student's short answer against a reference answer and source evidence.
Rules:
- Judge meaning, not wording. Synonyms and different phrasing that convey the same idea are correct.
- "correct": all key points present and nothing wrong. "partial": some key points present, none contradicted.
- "incorrect": key points missing or a factual error that contradicts the evidence.
- "ambiguous": the answer could be read as right or wrong and you cannot decide fairly. Be conservative.
- Feedback: 1-3 sentences addressed to the student. Say what was right, what was missing, and why.
Output: {"verdict","correct_points","missing_points","feedback"}`;

export const ASSISTANT_SYSTEM = `You explain topics using ONLY the student's uploaded material in the evidence blocks.
Rules:
- If the evidence does not contain enough to answer, set supported=false and say what is missing. Do not guess.
- Each factual claim goes in "claims" with the chunk_id it comes from and a word-for-word quote from that block.
- "answer" is a clear explanation (under 200 words) built only from those claims.
- If you add any reasoning that is not stated in the evidence, put it in "inference" (otherwise null).
Output: {"supported","answer","claims":[{"text","chunk_id","quote"}],"inference"}`;

export const OBJECTIVES_SYSTEM = `You write short, concrete study objectives for revision sessions.
Use the gap evidence given (what the student got wrong or missed). 1-3 objectives per session, each starting with a verb.
Output: {"sessions":[{"topic_id","objectives":[...]}]}`;
