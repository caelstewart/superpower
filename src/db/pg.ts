/**
 * PostgreSQL adapter for hosted/multi-machine mode (Neon, Supabase, RDS, or a
 * local postgres). Same schema.sql as SQLite with one dialect transform.
 * Connection: SUPERPOWER_DATABASE_URL or DATABASE_URL.
 */
import pg from "pg";
import type { Voice, Specimen, LintRule } from "../core/types.js";
import type { GenerationLog, Store } from "./database.js";
import { schemaSql } from "./database.js";

function pgSchema(): string {
  return schemaSql().replaceAll(
    "INTEGER PRIMARY KEY AUTOINCREMENT",
    "BIGSERIAL PRIMARY KEY"
  );
}

function now(): string {
  return new Date().toISOString();
}

export class PgStore implements Store {
  private constructor(private pool: pg.Pool) {}

  static async connect(url: string): Promise<PgStore> {
    // The connection string governs TLS (sslmode=verify-full for cloud hosts,
    // sslmode=disable for local). No code-level override — never weaken TLS.
    const pool = new pg.Pool({ connectionString: url, max: 5 });
    const store = new PgStore(pool);
    await pool.query(pgSchema());
    return store;
  }

  private async one<T>(sql: string, params: unknown[] = []): Promise<T | null> {
    const res = await this.pool.query(sql, params);
    return (res.rows[0] as T) ?? null;
  }

  private async all<T>(sql: string, params: unknown[] = []): Promise<T[]> {
    const res = await this.pool.query(sql, params);
    return res.rows as T[];
  }

  async createVoice(v: Omit<Voice, "created_at" | "updated_at">): Promise<Voice> {
    const t = now();
    const row = await this.one<Voice>(
      `INSERT INTO voices (id, name, description, identity, thinking, guidelines, default_type, created_at, updated_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *`,
      [v.id, v.name, v.description, v.identity, v.thinking, v.guidelines, v.default_type, t, t]
    );
    return row!;
  }

  async updateVoice(id: string, fields: Partial<Voice>): Promise<Voice> {
    const allowed = ["name", "description", "identity", "thinking", "guidelines", "default_type"] as const;
    const sets: string[] = [];
    const vals: unknown[] = [];
    let i = 1;
    for (const k of allowed) {
      if (fields[k] !== undefined) {
        sets.push(`${k} = $${i++}`);
        vals.push(fields[k]);
      }
    }
    if (sets.length === 0) return (await this.getVoice(id))!;
    sets.push(`updated_at = $${i++}`);
    vals.push(now());
    vals.push(id);
    const row = await this.one<Voice>(
      `UPDATE voices SET ${sets.join(", ")} WHERE id = $${i} RETURNING *`,
      vals
    );
    if (!row) throw new Error(`voice not found: ${id}`);
    return row;
  }

  async getVoice(id: string): Promise<Voice | null> {
    return this.one<Voice>("SELECT * FROM voices WHERE id = $1", [id]);
  }

  async deleteVoice(id: string): Promise<boolean> {
    const res = await this.pool.query("DELETE FROM voices WHERE id = $1", [id]);
    return (res.rowCount ?? 0) > 0;
  }

  async listVoices(): Promise<Voice[]> {
    return this.all<Voice>("SELECT * FROM voices ORDER BY name");
  }

  async addSpecimen(s: Omit<Specimen, "id" | "created_at" | "word_count">): Promise<Specimen> {
    const wc = s.body.split(/\s+/).filter(Boolean).length;
    const row = await this.one<Specimen>(
      `INSERT INTO specimens (voice_id, content_type, title, subtitle, body, word_count, quality, source, written_at, created_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING *`,
      [s.voice_id, s.content_type, s.title, s.subtitle, s.body, wc, s.quality, s.source, s.written_at, now()]
    );
    return row!;
  }

  async listSpecimens(voiceId: string, contentType?: string): Promise<Specimen[]> {
    if (contentType) {
      return this.all<Specimen>(
        "SELECT * FROM specimens WHERE voice_id = $1 AND content_type = $2 ORDER BY quality DESC, written_at DESC",
        [voiceId, contentType]
      );
    }
    return this.all<Specimen>(
      "SELECT * FROM specimens WHERE voice_id = $1 ORDER BY quality DESC, written_at DESC",
      [voiceId]
    );
  }

  async countSpecimens(voiceId: string): Promise<number> {
    const row = await this.one<{ c: string }>(
      "SELECT COUNT(*) AS c FROM specimens WHERE voice_id = $1",
      [voiceId]
    );
    return parseInt(row?.c ?? "0", 10);
  }

  async addLintRule(r: Omit<LintRule, "id" | "created_at">): Promise<LintRule> {
    const row = await this.one<LintRule>(
      `INSERT INTO lint_rules (voice_id, kind, value, message, severity, created_at)
       VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
      [r.voice_id, r.kind, r.value, r.message, r.severity, now()]
    );
    return row!;
  }

  async listLintRules(voiceId: string): Promise<LintRule[]> {
    return this.all<LintRule>("SELECT * FROM lint_rules WHERE voice_id = $1", [voiceId]);
  }

  async logGeneration(g: GenerationLog): Promise<void> {
    await this.pool.query(
      `INSERT INTO generations (voice_id, content_type, brief, output, provider, model, exemplar_count, lint_failures, revised, duration_ms, created_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
      [
        g.voice_id, g.content_type, g.brief, g.output, g.provider, g.model,
        g.exemplar_count, g.lint_failures, g.revised, g.duration_ms, now(),
      ]
    );
  }

  async close(): Promise<void> {
    await this.pool.end();
  }
}
