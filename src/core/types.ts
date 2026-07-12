export interface Voice {
  id: string;
  name: string;
  description: string;
  identity: string;
  thinking: string;
  guidelines: string;
  default_type: string;
  created_at: string;
  updated_at: string;
}

export interface Specimen {
  id: number;
  voice_id: string;
  content_type: string;
  title: string;
  subtitle: string;
  body: string;
  word_count: number;
  quality: number;
  source: string;
  written_at: string;
  created_at: string;
}

export type LintKind =
  | "banned_string"
  | "banned_pattern"
  | "max_sentence_words"
  | "required_pattern";

export interface LintRule {
  id: number;
  voice_id: string;
  kind: LintKind;
  value: string;
  message: string;
  severity: "error" | "warn";
  created_at: string;
}

export interface LintViolation {
  rule: LintRule;
  detail: string;
}

export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface GenerationResult {
  output: string;
  provider: string;
  model: string;
  exemplarCount: number;
  exemplarStates: { base: number; approved: number; archive: number };
  lintFailures: number;
  revised: boolean;
  durationMs: number;
  warnings: string[];
}
