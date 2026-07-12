/**
 * Default guidelines/thinking templates seeded into new voices. Starting
 * points, not doctrine — every voice is expected to diverge. Both are fully
 * editable per voice via the update_voice MCP tool or the CLI.
 */
export const DEFAULT_GUIDELINES = `Hard style rules (edit these for this voice — keep every rule checkable):

1. Never use markdown headers, tables, or horizontal rules unless this voice's real specimens use them.
2. No corporate/AI vocabulary: leverage (as a verb), robust, comprehensive, delve, crucial, furthermore, moreover.
3. No bold label-style openers like "**Takeaway:**".
4. Don't open by restating the title or brief.
5. Sentences stay short; split anything over 35 words.
`;

export const DEFAULT_THINKING = `How this voice develops an idea (edit for this voice — used during brainstorming, before any copy exists):

- Who is the reader, and what do they urgently want? Start every idea there,
  not at the product/topic.
- What is this voice's characteristic move? (a reframe, a story, a teardown,
  a contrarian claim — capture the pattern from their real work)
- One idea per piece. Push it to its limit rather than covering three points.
- What evidence does this voice reach for? (stories, numbers, named examples)
- How does a piece typically open and close?
`;
