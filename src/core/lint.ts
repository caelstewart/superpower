/**
 * Deterministic style lint. Catches what few-shot demonstration cannot
 * express: prohibitions. Runs after generation; violations trigger exactly
 * one revision pass.
 */
import type { LintRule, LintViolation } from "./types.js";

export function lint(text: string, rules: LintRule[]): LintViolation[] {
  const violations: LintViolation[] = [];
  for (const rule of rules) {
    switch (rule.kind) {
      case "banned_string": {
        if (text.toLowerCase().includes(rule.value.toLowerCase())) {
          violations.push({ rule, detail: `contains "${rule.value}"` });
        }
        break;
      }
      case "banned_pattern": {
        const re = new RegExp(rule.value, "mi");
        const m = text.match(re);
        if (m) violations.push({ rule, detail: `matches /${rule.value}/ ("${truncate(m[0])}")` });
        break;
      }
      case "max_sentence_words": {
        const limit = parseInt(rule.value, 10);
        const sentences = text.split(/(?<=[.!?])\s+/);
        const long = sentences.filter(
          (s) => s.split(/\s+/).filter(Boolean).length > limit
        );
        if (long.length > 0) {
          violations.push({
            rule,
            detail: `${long.length} sentence(s) over ${limit} words (e.g. "${truncate(long[0])}")`,
          });
        }
        break;
      }
      case "required_pattern": {
        const re = new RegExp(rule.value, "mi");
        if (!re.test(text)) {
          violations.push({ rule, detail: `missing required /${rule.value}/` });
        }
        break;
      }
    }
  }
  return violations;
}

export function violationMessages(violations: LintViolation[]): string[] {
  return violations.map((v) => `${v.rule.message} (${v.detail})`);
}

export function errorCount(violations: LintViolation[]): number {
  return violations.filter((v) => v.rule.severity === "error").length;
}

function truncate(s: string, n = 80): string {
  return s.length > n ? s.slice(0, n) + "…" : s;
}
