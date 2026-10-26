export interface DocumentRow {
  id: string; user_id: string; title: string; kind: "syllabus" | "notes" | "textbook" | "past_paper";
  file_name: string; mime_type: string; size_bytes: number; status: "processing" | "ready" | "failed";
  error: string | null; page_count: number | null; is_demo: boolean; created_at: string;
}
export interface TopicRow {
  id: string; user_id: string; parent_id: string | null; name: string; description: string | null;
  origin: "syllabus" | "inferred" | "manual"; prerequisite_ids: string[]; position: number;
}
export interface QuestionRow {
  id: string; session_id: string; user_id: string; topic_id: string; position: number; type: "mcq" | "short";
  difficulty: "easy" | "medium" | "hard"; prompt: string; options: string[] | null; correct_option: number | null;
  expected_answer: string; evidence_chunk_id: string; evidence_quote: string;
}
export interface AnswerRow {
  id: string; question_id: string; session_id: string; user_id: string; response: string | null; selected_option: number | null;
  verdict: "correct" | "partial" | "incorrect" | "unanswered" | "ambiguous"; score: number;
  method: "objective" | "ai_semantic" | "none"; feedback: string; missing_points: string[]; created_at: string;
}
export interface QuizSessionRow { id: string; user_id: string; status: "in_progress" | "submitted"; topic_ids: string[]; created_at: string; submitted_at: string | null }
export interface SourceRef { chunk_id: string; document_id: string; title: string; page: number | null; section: string | null }

export function formatSource(s: Pick<SourceRef, "title" | "page" | "section">): string {
  return [s.title, s.page != null ? `p. ${s.page}` : null, s.section].filter(Boolean).join(", ");
}
