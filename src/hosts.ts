// Reconcile host discovery links for one checkout.
// Canonical skill files stay in the configured overlay; this module owns only links and Git exclusions.

import { execFileSync } from "node:child_process";
import {
  existsSync,
  lstatSync,
  mkdirSync,
  readFileSync,
  readlinkSync,
  readdirSync,
  symlinkSync,
  unlinkSync,
  writeFileSync,
} from "node:fs";
import { basename, dirname, join, relative, resolve } from "node:path";
import type { Agent } from "./config.ts";

const hostDirs = [".agents/skills", ".claude/skills"] as const;

export function checkoutRoot(): string | undefined {
  try {
    return execFileSync("git", ["rev-parse", "--show-toplevel"], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    }).trim();
  } catch {
    return undefined;
  }
}

export function requiredHostDirs(agents: Agent[]): string[] {
  const dirs: string[] = [];
  if (agents.includes("codex") || agents.includes("cursor")) dirs.push(".agents/skills");
  if (agents.includes("claude-code")) dirs.push(".claude/skills");
  return dirs;
}

function linkTarget(path: string): string | undefined {
  try {
    if (!lstatSync(path).isSymbolicLink()) return undefined;
    return resolve(dirname(path), readlinkSync(path));
  } catch (error) {
    if (error instanceof Error && "code" in error && error.code === "ENOENT") return undefined;
    throw error;
  }
}

function managedTarget(path: string, overlay: string): string | undefined {
  const target = linkTarget(path);
  if (target && dirname(target) === overlay && basename(target) === basename(path)) return target;
  return undefined;
}

function excludePath(root: string): string {
  const path = execFileSync("git", ["-C", root, "rev-parse", "--git-path", "info/exclude"], {
    encoding: "utf8",
  }).trim();
  return resolve(root, path);
}

function excludePattern(hostDir: string, name: string): string {
  return `/${hostDir}/${name}`;
}

function addExclude(root: string, pattern: string): void {
  const path = excludePath(root);
  const old = existsSync(path) ? readFileSync(path, "utf8") : "";
  if (old.split("\n").includes(pattern)) return;
  mkdirSync(dirname(path), { recursive: true });
  const prefix = old && !old.endsWith("\n") ? "\n" : "";
  writeFileSync(path, `${old}${prefix}# stow: ${pattern}\n${pattern}\n`);
}

function removeExclude(root: string, pattern: string): void {
  const path = excludePath(root);
  if (!existsSync(path)) return;
  const lines = readFileSync(path, "utf8").split("\n");
  const kept: string[] = [];
  for (let index = 0; index < lines.length; index++) {
    if (lines[index] === `# stow: ${pattern}` && lines[index + 1] === pattern) {
      index++;
    } else {
      kept.push(lines[index]);
    }
  }
  const next = kept.join("\n");
  if (next !== lines.join("\n")) writeFileSync(path, next);
}

function wantedLinks(root: string, overlay: string, names: string[], agents: Agent[]): Map<string, string> {
  const wanted = new Map<string, string>();
  for (const hostDir of requiredHostDirs(agents)) {
    for (const name of names) {
      wanted.set(join(root, hostDir, name), join(overlay, name));
    }
  }
  return wanted;
}

export function assertHostLinksAvailable(root: string, overlay: string, names: string[], agents: Agent[]): void {
  const wanted = wantedLinks(root, overlay, names, agents);
  // Reject collisions before changing any host directory.
  for (const [path, target] of wanted) {
    const tracked = execFileSync("git", ["-C", root, "ls-files", "--", path], { encoding: "utf8" });
    if (tracked) throw new Error(`Host skill path is tracked by Git: ${path}`);
    try {
      lstatSync(path);
      if (linkTarget(path) !== target) throw new Error(`Host skill already exists: ${path}`);
    } catch (error) {
      if (!(error instanceof Error && "code" in error && error.code === "ENOENT")) throw error;
    }
  }
}

export function syncHostLinks(root: string, overlay: string, names: string[], agents: Agent[]): void {
  const wanted = wantedLinks(root, overlay, names, agents);
  assertHostLinksAvailable(root, overlay, names, agents);

  for (const hostDir of hostDirs) {
    const dir = join(root, hostDir);
    if (!existsSync(dir)) continue;
    for (const entry of readdirSync(dir)) {
      const path = join(dir, entry);
      if (managedTarget(path, overlay) && !wanted.has(path)) {
        unlinkSync(path);
        removeExclude(root, excludePattern(hostDir, entry));
      }
    }
  }

  for (const [path, target] of wanted) {
    mkdirSync(dirname(path), { recursive: true });
    if (linkTarget(path) === undefined) symlinkSync(target, path, "dir");
    const hostDir = relative(root, dirname(path));
    addExclude(root, excludePattern(hostDir, basename(path)));
  }
}

export function removeHostLinks(root: string, overlay: string, name: string): void {
  for (const hostDir of hostDirs) {
    const path = join(root, hostDir, name);
    if (managedTarget(path, overlay) === join(overlay, name)) unlinkSync(path);
    removeExclude(root, excludePattern(hostDir, name));
  }
}
