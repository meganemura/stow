#!/usr/bin/env bun
// Resolve a checkout's private skill overlay and manage its skill directories.
// Host integration and slash-command discovery belong to the host, not this CLI.

import { execFileSync } from "node:child_process";
import {
  cpSync,
  existsSync,
  lstatSync,
  mkdirSync,
  readdirSync,
  realpathSync,
  statSync,
  symlinkSync,
} from "node:fs";
import { homedir } from "node:os";
import { basename, join, resolve } from "node:path";

const help = `Usage: stow <command> [options]

Commands:
  path              Print this checkout's skill overlay path
  list              List skills in the overlay
  add <source-dir>  Copy a skill directory into the overlay
  open, init        Create the overlay and print its path

Options:
  --repo OWNER/REPO  Use this repository identity instead of origin
  --mkdir            Create the overlay with path
  --link             Symlink the source with add instead of copying it
  -h, --help         Show this help
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
  if (options.help || !options.command) {
    process.stdout.write(help);
    return;
  }
  if (!["path", "list", "add", "open", "init"].includes(options.command)) {
    throw new Error(`Unknown command: ${options.command}`);
  }
  if (options.link && options.command !== "add") {
    throw new Error("--link is only valid with add.");
  }
  if (options.mkdir && options.command !== "path") {
    throw new Error("--mkdir is only valid with path.");
  }
  if (options.source && options.command !== "add") {
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
  } else {
    if (!options.source) throw new Error("add requires a source directory.");
    const source = resolve(options.source);
    if (
      !existsSync(source) ||
      !statSync(source).isDirectory() ||
      !existsSync(join(source, "SKILL.md")) ||
      !statSync(join(source, "SKILL.md")).isFile()
    ) {
      throw new Error(`Expected a skill directory with SKILL.md: ${source}`);
    }
    const name = basename(source);
    if (!validSegment(name)) throw new Error(`Invalid skill name: ${name}`);
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
    process.stdout.write(`${destination}\n`);
  }
}

try {
  run(process.argv.slice(2));
} catch (error) {
  process.stderr.write(`stow: ${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 1;
}
