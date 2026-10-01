#!/usr/bin/env bun
// Resolve a checkout's private skill overlay and manage its skill directories.
// Host-specific discovery paths are delegated to the link reconciler.

import { execFileSync } from "node:child_process";
import {
  cpSync,
  existsSync,
  lstatSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  realpathSync,
  rmSync,
  statSync,
  symlinkSync,
} from "node:fs";
import { homedir } from "node:os";
import { basename, join, resolve } from "node:path";
import { assertHostLinksAvailable, checkoutRoot, configuredAgents, removeHostLinks, requiredHostDirs, syncHostLinks } from "./hosts.ts";

const help = `stow — personal skills for the current Git checkout

Usage: stow [command] [options]
Run from the target checkout. With no command, stow runs sync.
Skills live in ~/.stow/skills/<owner>/<repo>/<name>/SKILL.md.
The origin remote supplies owner/repo. Use --repo to override it.

First setup:
  Create ~/.stow/config.json with the agents you use:
    { "agents": ["codex", "claude-code", "cursor"] }
  Codex and Cursor use .agents/skills; Claude Code uses .claude/skills.
  Without this file, stow stores skills but creates no host links.
  To install this Bun CLI locally, run bun link in the stow checkout.

Typical workflow:
  1. Create a skill in the target checkout with your agent or another tool.
  2. Run: stow adopt .agents/skills/my-skill
     For Claude Code: stow adopt .claude/skills/my-skill
  3. Invoke it with $my-skill in Codex, or /my-skill in Claude Code or Cursor.
     A running host may need to refresh its skill list.

Commands:
  adopt <skill-dir> Move an untracked host skill to the private overlay.
                    Replace its directory with a link and add other host links.
                    The source must be in a configured host discovery path.
                    Tracked skills and source symlinks are rejected.
  add <source-dir>   Copy an external skill into the overlay and create host links.
                    With --link, link the source instead of copying it.
  sync              Update this checkout's links for the configured agents.
                    Use after changing config or opening another checkout.
                    Remove obsolete links that point into this overlay.
  remove <name>     Delete the overlay skill and its links from both host paths.
                    Ignore the agent setting during cleanup.
                    Preserve the original source of an overlay symlink.
  list              Print skill names in this checkout's overlay.
  path              Print the overlay directory; use --mkdir to create it.
  open, init        Create the overlay directory and print its path.

Options:
  --repo OWNER/REPO  Select an overlay instead of reading origin.
  --mkdir           Create the overlay with path only.
  --link            Link the source with add only.
  -h, --help        Show this help, also after a command.

Skill format:
  The directory name uses lowercase letters, digits, and hyphens.
  Its SKILL.md starts with matching name and description fields:
    ---
    name: my-skill
    description: Explain when the agent should use this skill.
    ---
    Instructions go here. Optional references/ files stay with the skill.

Git and existing skills:
  stow adds exact link paths to Git's local info/exclude file.
  Skill files stay outside the checkout; normal git add omits the links.
  Tracked files cannot be hidden with ignore rules. git add -f can add a link.
  add and adopt refuse existing overlay entries and conflicting host paths.
  sync and remove preserve unrelated host skills.
  After removal, run stow in other checkouts to clean up their broken links.
`;

function validSegment(value: string): boolean {
  return /^[A-Za-z0-9._-]+$/.test(value) && value !== "." && value !== "..";
}

function repositoryName(value: string): string {
  const parts = value.split("/");
  if (parts.length !== 2 || parts.some((part) => !validSegment(part))) {
    throw new Error(`Invalid repository identity: ${value}. Expected OWNER/REPO.`);
  }
  return parts.join("/");
}

export function repositoryFromRemote(remote: string): string {
  const trimmed = remote.trim();
  let path: string;
  if (trimmed.includes("://")) {
    path = new URL(trimmed).pathname.replace(/^\//, "");
  } else {
    const match = /^[^@:\s]+@[^:\s]+:(.+)$/.exec(trimmed);
    if (!match) {
      throw new Error(`Unsupported origin URL: ${trimmed}`);
    }
    path = match[1];
  }
  return repositoryName(path.replace(/\.git$/, ""));
}

export function overlayPath(repo: string, home = homedir()): string {
  const [owner, name] = repositoryName(repo).split("/");
  return join(home, ".stow", "skills", owner, name);
}

function currentRepository(override?: string): string {
  if (override) return repositoryName(override);
  let remote: string;
  try {
    remote = execFileSync("git", ["remote", "get-url", "origin"], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    });
  } catch {
    throw new Error("Cannot read origin. Use --repo OWNER/REPO to select an overlay.");
  }
  return repositoryFromRemote(remote);
}

function skillNames(dir: string): string[] {
  if (!existsSync(dir)) return [];
  return readdirSync(dir, { withFileTypes: true })
    .filter((entry) => {
      const skillDir = join(dir, entry.name);
      if (!entry.isDirectory() && !entry.isSymbolicLink()) return false;
      try {
        return statSync(join(skillDir, "SKILL.md")).isFile();
      } catch {
        return false;
      }
    })
    .map((entry) => entry.name)
    .sort();
}

function skillName(source: string): string {
  const name = basename(source);
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(name)) {
    throw new Error(`Invalid skill name: ${name}. Use lowercase letters, digits, and hyphens.`);
  }
  const skill = readFileSync(join(source, "SKILL.md"), "utf8");
  const frontmatter = /^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/.exec(skill)?.[1];
  const declaredName = /^name:\s*['"]?([a-z0-9-]+)['"]?\s*$/m.exec(frontmatter ?? "")?.[1];
  const description = /^description:\s*\S.*$/m.test(frontmatter ?? "");
  if (declaredName !== name || !description) {
    throw new Error(`SKILL.md must declare name: ${name} and a description.`);
  }
  return name;
}

type Options = {
  command?: string;
  source?: string;
  repo?: string;
  mkdir: boolean;
  link: boolean;
  help: boolean;
};

function parseArgs(args: string[]): Options {
  const options: Options = { mkdir: false, link: false, help: false };
  for (let index = 0; index < args.length; index++) {
    const arg = args[index];
    if (arg === "--help" || arg === "-h") options.help = true;
    else if (arg === "--mkdir") options.mkdir = true;
    else if (arg === "--link") options.link = true;
    else if (arg === "--repo") options.repo = args[++index];
    else if (arg.startsWith("--repo=")) options.repo = arg.slice(7);
    else if (arg.startsWith("-")) throw new Error(`Unknown option: ${arg}`);
    else if (!options.command) options.command = arg;
    else if (!options.source) options.source = arg;
    else throw new Error(`Unexpected argument: ${arg}`);
  }
  if (args.includes("--repo") && !options.repo) {
    throw new Error("--repo requires OWNER/REPO.");
  }
  return options;
}

function run(args: string[]): void {
  const options = parseArgs(args);
  if (options.help) {
    process.stdout.write(help);
    return;
  }
  options.command ??= "sync";
  if (!["path", "list", "add", "adopt", "remove", "sync", "open", "init"].includes(options.command)) {
    throw new Error(`Unknown command: ${options.command}`);
  }
  if (options.link && options.command !== "add") {
    throw new Error("--link is only valid with add.");
  }
  if (options.mkdir && options.command !== "path") {
    throw new Error("--mkdir is only valid with path.");
  }
  if (options.source && !["add", "adopt", "remove"].includes(options.command)) {
    throw new Error(`Unexpected argument: ${options.source}`);
  }

  const dir = overlayPath(currentRepository(options.repo));
  if (options.command === "path") {
    if (options.mkdir) mkdirSync(dir, { recursive: true });
    process.stdout.write(`${dir}\n`);
  } else if (options.command === "open" || options.command === "init") {
    mkdirSync(dir, { recursive: true });
    process.stdout.write(`${dir}\n`);
  } else if (options.command === "list") {
    for (const name of skillNames(dir)) process.stdout.write(`${name}\n`);
  } else if (options.command === "sync") {
    const root = checkoutRoot();
    if (!root) throw new Error("sync requires a Git checkout.");
    syncHostLinks(root, dir, skillNames(dir), configuredAgents(homedir()));
  } else if (options.command === "remove") {
    if (!options.source) throw new Error("remove requires a skill name.");
    const root = checkoutRoot();
    if (!root) throw new Error("remove requires a Git checkout to clean up host links.");
    const name = options.source;
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(name)) throw new Error(`Invalid skill name: ${name}`);
    const destination = join(dir, name);
    removeHostLinks(root, dir, name);
    rmSync(destination, { recursive: true, force: true });
    process.stdout.write(`${destination}\n`);
  } else {
    if (!options.source) throw new Error(`${options.command} requires a source directory.`);
    const source = resolve(options.source);
    if (
      !existsSync(source) ||
      !statSync(source).isDirectory() ||
      !existsSync(join(source, "SKILL.md")) ||
      !statSync(join(source, "SKILL.md")).isFile()
    ) {
      throw new Error(`Expected a skill directory with SKILL.md: ${source}`);
    }
    const name = skillName(source);
    const agents = configuredAgents(homedir());
    const root = checkoutRoot();
    if (agents.length && !root) throw new Error("add requires a Git checkout when agents are configured.");
    const adopting = options.command === "adopt";
    if (adopting) {
      if (!root || !requiredHostDirs(agents).some((hostDir) => source === join(root, hostDir, name))) {
        throw new Error("adopt requires a skill in a configured checkout host path. Set agents in ~/.stow/config.json.");
      }
      if (lstatSync(source).isSymbolicLink()) throw new Error("adopt requires a real skill directory, not a symlink.");
      const tracked = execFileSync("git", ["-C", root, "ls-files", "--", source], { encoding: "utf8" });
      if (tracked) throw new Error("Cannot adopt a tracked skill. Git exclusions apply only to untracked files.");
      assertHostLinksAvailable(root, dir, skillNames(dir), agents);
      for (const hostDir of requiredHostDirs(agents)) {
        const other = join(root, hostDir, name);
        if (other !== source) assertHostLinksAvailable(root, dir, [name], hostDir === ".claude/skills" ? ["claude-code"] : ["codex"]);
      }
    } else if (root) {
      assertHostLinksAvailable(root, dir, [...skillNames(dir), name], agents);
    }
    mkdirSync(dir, { recursive: true });
    const destination = join(dir, name);
    try {
      lstatSync(destination);
      throw new Error(`Skill already exists: ${destination}`);
    } catch (error) {
      if (!(error instanceof Error && "code" in error && error.code === "ENOENT")) {
        throw error;
      }
    }
    if (options.link) symlinkSync(realpathSync(source), destination, "dir");
    else cpSync(source, destination, { recursive: true, errorOnExist: true, force: false });
    if (adopting) rmSync(source, { recursive: true });
    if (root) syncHostLinks(root, dir, skillNames(dir), agents);
    process.stdout.write(`${destination}\n`);
  }
}

try {
  run(process.argv.slice(2));
} catch (error) {
  process.stderr.write(`stow: ${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 1;
}
