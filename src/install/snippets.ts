/**
 * Per-host trigger shims. Tool descriptions get ~90% auto-trigger reliability;
 * these rules snippets make it effectively deterministic.
 */
export const RULES_SNIPPET = `## Copywriting (superpower)

For ANY customer-facing writing — marketing copy, landing pages, ads, emails,
newsletters, social posts, product descriptions — do not write the copy yourself.
Use the superpower MCP tools:

1. At the start of a content/brainstorming conversation: call list_voices, then
   get_voice_context for the relevant voice, and ideate using that thinking framework.
2. When actual copy is needed: call generate_copy with a specific brief
   (topic, angle, key points, audience).
3. To check or align existing copy: call critique_copy.
4. When the user approves a piece: offer to save_specimen so the voice improves.
`;

export interface HostTarget {
  host: string;
  rulesPath: string; // relative to project root
  registerCmd: string;
}

export function hostTargets(serverCmd: string): HostTarget[] {
  return [
    {
      host: "claude-code",
      rulesPath: "CLAUDE.md",
      registerCmd: `claude mcp add superpower -- ${serverCmd}`,
    },
    {
      host: "cursor",
      rulesPath: ".cursor/rules/superpower.mdc",
      registerCmd: `add to ~/.cursor/mcp.json: {"mcpServers":{"superpower":{"command":"${serverCmd.split(" ")[0]}","args":${JSON.stringify(serverCmd.split(" ").slice(1))}}}}`,
    },
    {
      host: "windsurf",
      rulesPath: ".windsurfrules",
      registerCmd: `add to mcp_config.json: {"mcpServers":{"superpower":{"command":"${serverCmd.split(" ")[0]}","args":${JSON.stringify(serverCmd.split(" ").slice(1))}}}}`,
    },
    {
      host: "vscode",
      rulesPath: ".github/copilot-instructions.md",
      registerCmd: `add to .vscode/mcp.json: {"servers":{"superpower":{"type":"stdio","command":"${serverCmd.split(" ")[0]}","args":${JSON.stringify(serverCmd.split(" ").slice(1))}}}}`,
    },
  ];
}
