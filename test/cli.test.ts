// Exercise the public CLI against a temporary checkout and home directory.
// This keeps tests independent of the user's private overlays.

import { expect, setDefaultTimeout, test } from "bun:test";
import { spawnSync, execFileSync } from "node:child_process";
import {
  existsSync,
  lstatSync,
  mkdtempSync,
  mkdirSync,
  readFileSync,
  readlinkSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { basename, dirname, join, resolve } from "node:path";

const cli = process.env.STOW_TEST_CLI ?? resolve(import.meta.dir, "../src/cli.ts");
const cliRuntime = process.env.STOW_TEST_RUNTIME ?? process.execPath;
// Each case starts several Git and Bun processes, which can exceed five seconds on a busy machine.
setDefaultTimeout(30_000);

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
      spawnSync(cliRuntime, [cli, ...args], {
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
    expect(run("init").stdout.trim()).toBe(join(home, ".stow", "config.json"));

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
      spawnSync(cliRuntime, [cli, ...args], {
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
      spawnSync(cliRuntime, [cli, ...args], {
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
    const run = (...args: string[]) => spawnSync(cliRuntime, [cli, ...args], {
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

for (const storageMode of ["absolute", "home", "relative", "symlink"] as const) {
  test(`skills repository checkout works with storage mode: ${storageMode}`, () => {
    const root = mkdtempSync(join(tmpdir(), "stow-test-"));
    try {
      const checkout = join(root, "checkout");
      const home = join(root, "home");
      const storage = join(home, "private-skills");
      const configDir = join(home, ".stow");
      mkdirSync(configDir, { recursive: true });
      execFileSync("git", ["init", "-q", checkout]);
      execFileSync("git", ["-C", checkout, "remote", "add", "origin", "git@github.com:alice/project.git"]);
      execFileSync("git", ["init", "-q", storage]);
      const skillsRoot = join(storage, "skills");
      writeSkill(join(skillsRoot, "alice", "project", "existing"));
      const skillsDir = storageMode === "absolute" ? skillsRoot
        : storageMode === "home" ? "~/private-skills/skills"
        : storageMode === "relative" ? "../private-skills/skills" : undefined;
      writeFileSync(join(configDir, "config.json"), JSON.stringify({ agents: ["codex"], skillsDir }));
      if (storageMode === "symlink") symlinkSync(skillsRoot, join(configDir, "skills"), "dir");
      const run = (...args: string[]) => spawnSync(cliRuntime, [cli, ...args], {
        cwd: checkout,
        env: { ...process.env, HOME: home },
        encoding: "utf8",
      });
      const overlay = storageMode === "symlink" ? join(configDir, "skills", "alice", "project")
        : join(skillsRoot, "alice", "project");
      expect(run("path").stdout.trim()).toBe(overlay);
      expect(run().status).toBe(0);
      expect(readlinkSync(join(checkout, ".agents", "skills", "existing"))).toBe(join(overlay, "existing"));
      expect(run("list").stdout).toBe("existing\n");

      writeSkill(join(checkout, ".agents", "skills", "generated"));
      expect(run("adopt", ".agents/skills/generated").status).toBe(0);
      expect(readFileSync(join(skillsRoot, "alice", "project", "generated", "SKILL.md"), "utf8")).toContain("name: generated");
      expect(execFileSync("git", ["-C", checkout, "status", "--porcelain"], { encoding: "utf8" })).toBe("");
      expect(execFileSync("git", ["-C", storage, "status", "--porcelain"], { encoding: "utf8" })).toContain("skills/");
      expect(run("remove", "generated").status).toBe(0);
      expect(existsSync(join(skillsRoot, "alice", "project", "generated"))).toBe(false);
      expect(existsSync(join(skillsRoot, "alice", "project", "existing", "SKILL.md"))).toBe(true);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
}

for (const [agent, nativePath] of [
  ["antigravity", ".agent/skills"],
  ["pi", ".pi/skills"],
  ["gemini-cli", ".gemini/skills"],
  ["github-copilot", ".github/skills"],
  ["opencode", ".opencode/skills"],
  ["devin-desktop", ".windsurf/skills"],
] as const) {
  test(`${agent} adopts native skills into the shared path and cleans links after a config change`, () => {
    const root = mkdtempSync(join(tmpdir(), "stow-test-"));
    try {
      const checkout = join(root, "checkout");
      const home = join(root, "home");
      execFileSync("git", ["init", "-q", checkout]);
      execFileSync("git", ["-C", checkout, "remote", "add", "origin", "git@github.com:alice/project.git"]);
      const run = (...args: string[]) => spawnSync(cliRuntime, [cli, ...args], {
        cwd: checkout, env: { ...process.env, HOME: home }, encoding: "utf8",
      });
      expect(run("init", "--agents", agent).status).toBe(0);
      const source = join(checkout, nativePath, "generated");
      writeSkill(source);
      const content = readFileSync(join(source, "SKILL.md"), "utf8");
      expect(run("adopt", join(nativePath, "generated")).status).toBe(0);
      const overlay = join(home, ".stow", "skills", "alice", "project", "generated");
      const shared = join(checkout, ".agents", "skills", "generated");
      expect(readlinkSync(shared)).toBe(overlay);
      expect(readFileSync(join(shared, "SKILL.md"), "utf8")).toBe(content);
      expect(existsSync(source)).toBe(false);
      expect(run().status).toBe(0);
      expect(execFileSync("git", ["-C", checkout, "status", "--porcelain"], { encoding: "utf8" })).toBe("");
      symlinkSync(overlay, source, "dir");
      writeFileSync(join(home, ".stow", "config.json"), JSON.stringify({ agents: [] }));
      expect(run("remove", "generated").status).toBe(0);
      expect(existsSync(shared)).toBe(false);
      expect(() => lstatSync(source)).toThrow();
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
}

test("init creates editable configuration before any skill storage, without a Git checkout", () => {
  const root = mkdtempSync(join(tmpdir(), "stow-test-"));
  try {
    const home = join(root, "home");
    const run = (...args: string[]) => spawnSync(cliRuntime, [cli, ...args], {
      cwd: root,
      env: { ...process.env, HOME: home },
      encoding: "utf8",
    });
    const configPath = join(home, ".stow", "config.json");
    expect(run("init").stdout.trim()).toBe(configPath);
    expect(existsSync(join(home, ".stow", "skills"))).toBe(false);
    const chosen = join(root, "skills-checkout", "skills");
    const content = JSON.stringify({ agents: ["codex"], skillsDir: chosen });
    writeFileSync(configPath, content);
    expect(run("init").status).toBe(0);
    expect(readFileSync(configPath, "utf8")).toBe(content);
    expect(run("init", "--skills-dir", "~/other").status).toBe(1);
    expect(readFileSync(configPath, "utf8")).toBe(content);
    expect(run("path", "--mkdir", "--repo", "alice/project").status).toBe(0);
    expect(existsSync(join(chosen, "alice", "project"))).toBe(true);
    expect(existsSync(join(home, ".stow", "skills"))).toBe(false);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("init accepts a storage path and agent list, and rejects invalid settings before writing", () => {
  const root = mkdtempSync(join(tmpdir(), "stow-test-"));
  try {
    const home = join(root, "home");
    const run = (...args: string[]) => spawnSync(cliRuntime, [cli, ...args], {
      cwd: root,
      env: { ...process.env, HOME: home },
      encoding: "utf8",
    });
    expect(run("init", "--agents", "unknown").status).toBe(1);
    expect(run("init", "--skills-dir").status).toBe(1);
    expect(existsSync(join(home, ".stow"))).toBe(false);
    expect(run("init", "--skills-dir", "~/private-skills/skills", "--agents", "codex,claude-code,codex").status).toBe(0);
    expect(JSON.parse(readFileSync(join(home, ".stow", "config.json"), "utf8"))).toEqual({
      agents: ["codex", "claude-code"], skillsDir: "~/private-skills/skills",
    });
    expect(run("path", "--repo", "alice/project").stdout.trim()).toBe(join(home, "private-skills", "skills", "alice", "project"));
    expect(existsSync(join(home, "private-skills"))).toBe(false);
    expect(run("list", "--skills-dir", "~/other", "--repo", "alice/project").status).toBe(1);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("agent-instructions guides setup without creating files and reports current configuration", () => {
  const root = mkdtempSync(join(tmpdir(), "stow-test-"));
  try {
    const home = join(root, "home");
    const run = (...args: string[]) => spawnSync(cliRuntime, [cli, ...args], {
      cwd: root, env: { ...process.env, HOME: home }, encoding: "utf8",
    });
    const initial = run("agent-instructions");
    expect(initial.status).toBe(0);
    expect(initial.stdout).toContain('"configExists": false');
    expect(initial.stdout).toContain("stow init --agents=codex");
    expect(initial.stdout).toContain("Wait for the answer before you create, copy, or move a skill.");
    expect(existsSync(join(home, ".stow"))).toBe(false);

    expect(run("init", "--agents=codex,pi", "--skills-dir=~/private-skills/skills").status).toBe(0);
    const configured = run("agent-instructions", "--repo=alice/project");
    expect(configured.status).toBe(0);
    expect(configured.stdout).toContain('"configExists": true');
    expect(configured.stdout).toContain('"repositoryOverride": "alice/project"');
    expect(configured.stdout).toContain(JSON.stringify(join(home, "private-skills", "skills")));
    expect(existsSync(join(home, "private-skills"))).toBe(false);
    writeFileSync(join(home, ".stow", "config.json"), "invalid json");
    const broken = run("agent-instructions");
    expect(broken.status).toBe(0);
    expect(broken.stdout).toContain('"configError":');
    expect(readFileSync(join(home, ".stow", "config.json"), "utf8")).toBe("invalid json");
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("--repo selects an overlay without origin", () => {
  const root = mkdtempSync(join(tmpdir(), "stow-test-"));
  try {
    const result = spawnSync(cliRuntime, [cli, "path", "--repo", "other/project"], {
      cwd: root,
      env: { ...process.env, HOME: root },
      encoding: "utf8",
    });
    expect(result.status).toBe(0);
    expect(result.stdout.trim()).toBe(join(root, ".stow", "skills", "other", "project"));

    const invalid = spawnSync(cliRuntime, [cli, "path", "--repo", "../escape"], {
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
