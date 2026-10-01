// Define host skill paths and read the user's agents and skill storage path.
// Git operations belong to the CLI and host link reconciler.

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";

// The first path is the output path; other paths are accepted adoption sources.
export const agentPaths = {
  "claude-code": [".claude/skills"],
  codex: [".agents/skills"],
  cursor: [".agents/skills", ".cursor/skills", ".claude/skills"],
  antigravity: [".agents/skills", ".agent/skills"],
  pi: [".agents/skills", ".pi/skills"],
  "gemini-cli": [".agents/skills", ".gemini/skills"],
  "github-copilot": [".agents/skills", ".github/skills", ".claude/skills"],
  opencode: [".agents/skills", ".opencode/skills", ".claude/skills"],
  "devin-desktop": [".agents/skills", ".devin/skills", ".windsurf/skills"],
} as const;
export type Agent = keyof typeof agentPaths;
export const agentNames = Object.keys(agentPaths) as Agent[];

function validateAgents(agents: unknown, configPath: string): Agent[] {
  if (!Array.isArray(agents) || agents.some((agent) => !agentNames.includes(agent))) {
    throw new Error(`${configPath} must contain an agents array. Supported agents: ${agentNames.join(", ")}.`);
  }
  return [...new Set(agents)] as Agent[];
}

export function initConfig(home: string, skillsDir?: string, agents?: string[]): string {
  const configDir = join(home, ".stow");
  const configPath = join(configDir, "config.json");
  if (existsSync(configPath)) {
    if (skillsDir !== undefined || agents !== undefined) {
      throw new Error(`Config already exists: ${configPath}. Edit it to change the settings.`);
    }
    return configPath;
  }
  const config = {
    agents: validateAgents(agents ?? [], configPath),
    skillsDir: skillsDir ?? "~/.stow/skills",
  };
  if (!config.skillsDir.trim()) throw new Error("--skills-dir requires a nonempty path.");
  mkdirSync(configDir, { recursive: true });
  // Exclusive creation preserves a config written by another process during setup.
  writeFileSync(configPath, `${JSON.stringify(config, null, 2)}\n`, { flag: "wx" });
  return configPath;
}

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
  const validatedAgents = validateAgents(agents, configPath);
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
  return { agents: validatedAgents, skillsDir };
}
