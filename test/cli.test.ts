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
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

const cli = resolve(import.meta.dir, "../src/cli.ts");

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
    writeFileSync(join(copy, "SKILL.md"), "# Copied\n");
    writeFileSync(join(copy, "references", "note.md"), "note\n");
    expect(run("add", copy).status).toBe(0);
    expect(readFileSync(join(overlay, "copied", "references", "note.md"), "utf8")).toBe("note\n");
    expect(run("add", copy).stderr).toContain("Skill already exists");

    const linked = join(root, "linked");
    mkdirSync(linked);
    writeFileSync(join(linked, "SKILL.md"), "# Linked\n");
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
