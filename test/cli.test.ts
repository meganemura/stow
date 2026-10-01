// Exercise the public CLI against a temporary checkout and home directory.
// This keeps tests independent of the user's private overlays.

import { expect, test } from "bun:test";
import { spawnSync, execFileSync } from "node:child_process";
import {
  existsSync,
  lstatSync,
  mkdtempSync,
  mkdirSync,
  readFileSync,
  readlinkSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { basename, dirname, join, resolve } from "node:path";

const cli = resolve(import.meta.dir, "../src/cli.ts");

function writeSkill(dir: string): void {
  mkdirSync(dir, { recursive: true });
  const name = basename(dir);
  writeFileSync(join(dir, "SKILL.md"), `---\nname: ${name}\ndescription: Test skill.\n---\n\n# ${name}\n`);
}

test("path, add, list, and link use the origin overlay", () => {
  const root = mkdtempSync(join(tmpdir(), "stow-test-"));
  try {
    const checkout = join(root, "checkout");
    const home = join(root, "home");
    mkdirSync(home);
    execFileSync("git", ["init", "-q", checkout]);
    execFileSync("git", ["-C", checkout, "remote", "add", "origin", "git@github.com:alice/project.git"]);

    const run = (...args: string[]) =>
      spawnSync(process.execPath, [cli, ...args], {
        cwd: checkout,
        env: { ...process.env, HOME: home },
        encoding: "utf8",
      });
    const overlay = join(home, ".stow", "skills", "alice", "project");
    expect(run("path").stdout.trim()).toBe(overlay);
    expect(existsSync(overlay)).toBe(false);
    expect(run("path", "--mkdir").status).toBe(0);
    expect(existsSync(overlay)).toBe(true);
    expect(run("list").stdout).toBe("");

    const copy = join(root, "copied");
    mkdirSync(join(copy, "references"), { recursive: true });
    writeSkill(copy);
    writeFileSync(join(copy, "references", "note.md"), "note\n");
    expect(run("add", copy).status).toBe(0);
    expect(readFileSync(join(overlay, "copied", "references", "note.md"), "utf8")).toBe("note\n");
    expect(run("add", copy).stderr).toContain("Skill already exists");

    const linked = join(root, "linked");
    writeSkill(linked);
    expect(run("add", linked, "--link").status).toBe(0);
    expect(lstatSync(join(overlay, "linked")).isSymbolicLink()).toBe(true);
    expect(run("list").stdout).toBe("copied\nlinked\n");
    expect(run("open").stdout.trim()).toBe(overlay);
    expect(run("init").stdout.trim()).toBe(overlay);

    execFileSync("git", ["-C", checkout, "remote", "set-url", "origin", "https://github.com/bob/second.git"]);
    expect(run("path").stdout.trim()).toBe(join(home, ".stow", "skills", "bob", "second"));
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("configured agents get ignored links, and remove cleans both paths after config changes", () => {
  const root = mkdtempSync(join(tmpdir(), "stow-test-"));
  try {
    const checkout = join(root, "checkout");
    const home = join(root, "home");
    const config = join(home, ".stow", "config.json");
    const source = join(root, "example");
    mkdirSync(dirname(config), { recursive: true });
    writeFileSync(config, JSON.stringify({ agents: ["claude-code", "codex", "cursor"] }));
    writeSkill(source);
    execFileSync("git", ["init", "-q", checkout]);
    execFileSync("git", ["-C", checkout, "remote", "add", "origin", "git@github.com:alice/project.git"]);
    const run = (...args: string[]) =>
      spawnSync(process.execPath, [cli, ...args], {
        cwd: checkout,
        env: { ...process.env, HOME: home },
        encoding: "utf8",
      });

    expect(run("add", source, "--link").status).toBe(0);
    const overlaySkill = join(home, ".stow", "skills", "alice", "project", "example");
    const agentsLink = join(checkout, ".agents", "skills", "example");
    const claudeLink = join(checkout, ".claude", "skills", "example");
    expect(readlinkSync(agentsLink)).toBe(overlaySkill);
    expect(readlinkSync(claudeLink)).toBe(overlaySkill);
    expect(execFileSync("git", ["-C", checkout, "status", "--porcelain"], { encoding: "utf8" })).toBe("");

    writeFileSync(config, JSON.stringify({ agents: [] }));
    expect(run("remove", "example").status).toBe(0);
    expect(existsSync(agentsLink)).toBe(false);
    expect(existsSync(claudeLink)).toBe(false);
    expect(existsSync(overlaySkill)).toBe(false);
    expect(existsSync(source)).toBe(true);
    const exclude = readFileSync(join(checkout, ".git", "info", "exclude"), "utf8");
    expect(exclude).not.toContain("stow:");
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("sync changes host paths and add refuses collisions", () => {
  const root = mkdtempSync(join(tmpdir(), "stow-test-"));
  try {
    const checkout = join(root, "checkout");
    const home = join(root, "home");
    const config = join(home, ".stow", "config.json");
    const source = join(root, "example");
    mkdirSync(dirname(config), { recursive: true });
    writeFileSync(config, JSON.stringify({ agents: ["cursor"] }));
    writeSkill(source);
    execFileSync("git", ["init", "-q", checkout]);
    execFileSync("git", ["-C", checkout, "remote", "add", "origin", "git@github.com:alice/project.git"]);
    const run = (...args: string[]) =>
      spawnSync(process.execPath, [cli, ...args], {
        cwd: checkout,
        env: { ...process.env, HOME: home },
        encoding: "utf8",
      });

    expect(run("add", source).status).toBe(0);
    const agentsLink = join(checkout, ".agents", "skills", "example");
    const claudeLink = join(checkout, ".claude", "skills", "example");
    expect(lstatSync(agentsLink).isSymbolicLink()).toBe(true);
    writeFileSync(config, JSON.stringify({ agents: ["claude-code"] }));
    expect(run("sync").status).toBe(0);
    expect(existsSync(agentsLink)).toBe(false);
    expect(lstatSync(claudeLink).isSymbolicLink()).toBe(true);

    const collision = join(root, "collision");
    writeSkill(collision);
    mkdirSync(join(checkout, ".claude", "skills", "collision"));
    const failed = run("add", collision);
    expect(failed.status).toBe(1);
    expect(failed.stderr).toContain("Host skill already exists");
    expect(existsSync(join(home, ".stow", "skills", "alice", "project", "collision"))).toBe(false);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("adopt hides a generated host skill and refuses tracked skills", () => {
  const root = mkdtempSync(join(tmpdir(), "stow-test-"));
  try {
    const checkout = join(root, "checkout");
    const home = join(root, "home");
    const config = join(home, ".stow", "config.json");
    mkdirSync(dirname(config), { recursive: true });
    writeFileSync(config, JSON.stringify({ agents: ["codex", "claude-code"] }));
    execFileSync("git", ["init", "-q", checkout]);
    execFileSync("git", ["-C", checkout, "remote", "add", "origin", "git@github.com:alice/project.git"]);
    const source = join(checkout, ".agents", "skills", "generated");
    writeSkill(source);
    const content = readFileSync(join(source, "SKILL.md"), "utf8");
    const run = (...args: string[]) => spawnSync(process.execPath, [cli, ...args], {
      cwd: checkout,
      env: { ...process.env, HOME: home },
      encoding: "utf8",
    });

    expect(run("adopt", ".agents/skills/generated").status).toBe(0);
    expect(lstatSync(source).isSymbolicLink()).toBe(true);
    expect(readFileSync(join(source, "SKILL.md"), "utf8")).toBe(content);
    expect(lstatSync(join(checkout, ".claude", "skills", "generated")).isSymbolicLink()).toBe(true);
    expect(execFileSync("git", ["-C", checkout, "status", "--porcelain"], { encoding: "utf8" })).toBe("");
    expect(run().status).toBe(0);

    const tracked = join(checkout, ".agents", "skills", "tracked");
    writeSkill(tracked);
    execFileSync("git", ["-C", checkout, "add", ".agents/skills/tracked"]);
    const failed = run("adopt", ".agents/skills/tracked");
    expect(failed.status).toBe(1);
    expect(failed.stderr).toContain("Cannot adopt a tracked skill");
    expect(lstatSync(tracked).isDirectory()).toBe(true);
    expect(existsSync(join(home, ".stow", "skills", "alice", "project", "tracked"))).toBe(false);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("--repo selects an overlay without origin", () => {
  const root = mkdtempSync(join(tmpdir(), "stow-test-"));
  try {
    const result = spawnSync(process.execPath, [cli, "path", "--repo", "other/project"], {
      cwd: root,
      env: { ...process.env, HOME: root },
      encoding: "utf8",
    });
    expect(result.status).toBe(0);
    expect(result.stdout.trim()).toBe(join(root, ".stow", "skills", "other", "project"));

    const invalid = spawnSync(process.execPath, [cli, "path", "--repo", "../escape"], {
      cwd: root,
      env: { ...process.env, HOME: root },
      encoding: "utf8",
    });
    expect(invalid.status).toBe(1);
    expect(invalid.stderr).toContain("Invalid repository identity");
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
