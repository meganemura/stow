// Read the user's agents and skill storage path.
// Git operations belong to the CLI and host link reconciler.

import { existsSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";

export type Agent = "claude-code" | "codex" | "cursor";
const agentNames: Agent[] = ["claude-code", "codex", "cursor"];

export function loadConfig(home: string): { agents: Agent[]; skillsDir: string } {
  const configDir = join(home, ".stow");
  const configPath = join(configDir, "config.json");
  const defaults = { agents: [] as Agent[], skillsDir: join(configDir, "skills") };
  if (!existsSync(configPath)) return defaults;
  let config: unknown;
  try {
    config = JSON.parse(readFileSync(configPath, "utf8"));
  } catch {
    throw new Error(`Cannot parse ${configPath}.`);
  }
  const agents = (config as { agents?: unknown } | null)?.agents;
  if (!Array.isArray(agents) || agents.some((agent) => !agentNames.includes(agent))) {
    throw new Error(`${configPath} must contain an agents array of claude-code, codex, or cursor.`);
  }
  const configuredPath = (config as { skillsDir?: unknown }).skillsDir;
  if (configuredPath !== undefined && (typeof configuredPath !== "string" || !configuredPath.trim())) {
    throw new Error(`${configPath}: skillsDir must be a nonempty path string.`);
  }
  let skillsDir = defaults.skillsDir;
  if (typeof configuredPath === "string") {
    if (configuredPath === "~") skillsDir = home;
    else if (configuredPath.startsWith("~/")) skillsDir = resolve(home, configuredPath.slice(2));
    else skillsDir = resolve(configDir, configuredPath);
  }
  return { agents: [...new Set(agents)] as Agent[], skillsDir };
}
