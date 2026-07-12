/**
 * Storage layer. Two adapters behind one async Store interface:
 *  - SqliteStore (node:sqlite) — local mode, zero native deps, ships via npx
 *  - PgStore (pg) — hosted mode, set SUPERPOWER_DATABASE_URL / DATABASE_URL
 */
import { DatabaseSync } from "node:sqlite";
import { readFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { homedir } from "node:os";
import type { Voice, Specimen, LintRule } from "../core/types.js";

const __dirname = dirname(fileURLToPath(import.meta.url));

export function defaultDbPath(): string {
  return (
    process.env.SUPERPOWER_DB ?? join(homedir(), ".superpower", "superpower.db")
  );
}

export function schemaSql(): string {
  return readFileSync(join(__dirname, "schema.sql"), "utf8");
}

function now(): string {
  return new Date().toISOString();
}

export interface GenerationLog {
  voice_id: string; content_type: string; brief: string; output: string;
  provider: string; model: string; exemplar_count: number;
  lint_failures: number; revised: number; duration_ms: number;
}

export interface Store {
  createVoice(v: Omit<Voice, "created_at" | "updated_at">): Promise<Voice>;
  updateVoice(id: string, fields: Partial<Voice>): Promise<Voice>;
  getVoice(id: string): Promise<Voice | null>;
  deleteVoice(id: string): Promise<boolean>;
  listVoices(): Promise<Voice[]>;
  addSpecimen(s: Omit<Specimen, "id" | "created_at" | "word_count">): Promise<Specimen>;
  updateSpecimen(voiceId: string, id: number, fields: Partial<Pick<Specimen, "quality" | "content_type" | "title">>): Promise<Specimen | null>;
  listSpecimens(voiceId: string, contentType?: string): Promise<Specimen[]>;
  countSpecimens(voiceId: string): Promise<number>;
  addLintRule(r: Omit<LintRule, "id" | "created_at">): Promise<LintRule>;
  listLintRules(voiceId: string): Promise<LintRule[]>;
  logGeneration(g: GenerationLog): Promise<void>;
  close(): Promise<void>;
}

/** Picks Postgres when SUPERPOWER_DATABASE_URL/DATABASE_URL is set, else SQLite. */
export async function createStore(): Promise<Store> {
  const url = process.env.SUPERPOWER_DATABASE_URL ?? process.env.DATABASE_URL;
  if (url) {
    const { PgStore } = await import("./pg.js");
    return PgStore.connect(url);
  }
  return new SqliteStore();
}

export class SqliteStore implements Store {
  private db: DatabaseSync;

  constructor(path: string = defaultDbPath()) {
    if (path !== ":memory:") mkdirSync(dirname(path), { recursive: true });
    this.db = new DatabaseSync(path);
    this.db.exec("PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;");
    this.db.exec(schemaSql());
  }

  async createVoice(v: Omit<Voice, "created_at" | "updated_at">): Promise<Voice> {
    const t = now();
    this.db
      .prepare(
        `INSERT INTO voices (id, name, description, identity, thinking, guidelines, default_type, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(v.id, v.name, v.description, v.identity, v.thinking, v.guidelines, v.default_type, t, t);
    return (await this.getVoice(v.id))!;
  }

  async updateVoice(id: string, fields: Partial<Voice>): Promise<Voice> {
    const allowed = ["name", "description", "identity", "thinking", "guidelines", "default_type"] as const;
    const sets: string[] = [];
    const vals: unknown[] = [];
    for (const k of allowed) {
      if (fields[k] !== undefined) {
        sets.push(`${k} = ?`);
        vals.push(fields[k]);
      }
    }
    if (sets.length === 0) return (await this.getVoice(id))!;
    sets.push("updated_at = ?");
    vals.push(now(), id);
    this.db.prepare(`UPDATE voices SET ${sets.join(", ")} WHERE id = ?`).run(...(vals as never[]));
    const v = await this.getVoice(id);
    if (!v) throw new Error(`voice not found: ${id}`);
    return v;
  }

  async getVoice(id: string): Promise<Voice | null> {
    const row = this.db.prepare("SELECT * FROM voices WHERE id = ?").get(id);
    return (row as unknown as Voice) ?? null;
  }

  async deleteVoice(id: string): Promise<boolean> {
    const res = this.db.prepare("DELETE FROM voices WHERE id = ?").run(id);
    return Number(res.changes) > 0;
  }

  async listVoices(): Promise<Voice[]> {
    return this.db.prepare("SELECT * FROM voices ORDER BY name").all() as unknown as Voice[];
  }

  async addSpecimen(s: Omit<Specimen, "id" | "created_at" | "word_count">): Promise<Specimen> {
    const wc = s.body.split(/\s+/).filter(Boolean).length;
    const res = this.db
      .prepare(
        `INSERT INTO specimens (voice_id, content_type, title, subtitle, body, word_count, quality, source, written_at, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(s.voice_id, s.content_type, s.title, s.subtitle, s.body, wc, s.quality, s.source, s.written_at, now());
    return this.db
      .prepare("SELECT * FROM specimens WHERE id = ?")
      .get(Number(res.lastInsertRowid)) as unknown as Specimen;
  }

  async updateSpecimen(
    voiceId: string,
    id: number,
    fields: Partial<Pick<Specimen, "quality" | "content_type" | "title">>
  ): Promise<Specimen | null> {
    const allowed = ["quality", "content_type", "title"] as const;
    const sets: string[] = [];
    const vals: unknown[] = [];
    for (const k of allowed) {
      if (fields[k] !== undefined) {
        sets.push(`${k} = ?`);
        vals.push(fields[k]);
      }
    }
    if (sets.length > 0) {
      vals.push(voiceId, id);
      this.db
        .prepare(`UPDATE specimens SET ${sets.join(", ")} WHERE voice_id = ? AND id = ?`)
        .run(...(vals as never[]));
    }
    return (this.db
      .prepare("SELECT * FROM specimens WHERE voice_id = ? AND id = ?")
      .get(voiceId, id) as unknown as Specimen) ?? null;
  }

  async listSpecimens(voiceId: string, contentType?: string): Promise<Specimen[]> {
    if (contentType) {
      return this.db
        .prepare(
          "SELECT * FROM specimens WHERE voice_id = ? AND content_type = ? ORDER BY quality DESC, written_at DESC"
        )
        .all(voiceId, contentType) as unknown as Specimen[];
    }
    return this.db
      .prepare("SELECT * FROM specimens WHERE voice_id = ? ORDER BY quality DESC, written_at DESC")
      .all(voiceId) as unknown as Specimen[];
  }

  async countSpecimens(voiceId: string): Promise<number> {
    const row = this.db
      .prepare("SELECT COUNT(*) AS c FROM specimens WHERE voice_id = ?")
      .get(voiceId) as { c: number };
    return row.c;
  }

  async addLintRule(r: Omit<LintRule, "id" | "created_at">): Promise<LintRule> {
    const res = this.db
      .prepare(
        `INSERT INTO lint_rules (voice_id, kind, value, message, severity, created_at)
         VALUES (?, ?, ?, ?, ?, ?)`
      )
      .run(r.voice_id, r.kind, r.value, r.message, r.severity, now());
    return this.db
      .prepare("SELECT * FROM lint_rules WHERE id = ?")
      .get(Number(res.lastInsertRowid)) as unknown as LintRule;
  }

  async listLintRules(voiceId: string): Promise<LintRule[]> {
    return this.db
      .prepare("SELECT * FROM lint_rules WHERE voice_id = ?")
      .all(voiceId) as unknown as LintRule[];
  }

  async logGeneration(g: GenerationLog): Promise<void> {
    this.db
      .prepare(
        `INSERT INTO generations (voice_id, content_type, brief, output, provider, model, exemplar_count, lint_failures, revised, duration_ms, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        g.voice_id, g.content_type, g.brief, g.output, g.provider, g.model,
        g.exemplar_count, g.lint_failures, g.revised, g.duration_ms, now()
      );
  }

  async close(): Promise<void> {
    this.db.close();
  }
}
