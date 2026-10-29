import { defineStep, z } from "nukadoko";
import { lstatSync, realpathSync } from "node:fs";
import { join } from "node:path";
import configureStow from "./configure-stow.ts";
import createTargetCheckout from "./create-target-checkout.ts";
import writeGeneratedSkill from "./write-generated-skill.ts";

export const HOST_PATHS = { codex: ".agents/skills", claudeCode: ".claude/skills" };

// Codex reads .agents/skills and Claude Code reads .claude/skills; realpath on
// both sides tolerates a temp directory that is itself behind a symlink, as on
// macOS. A path that is not a link reads as such, so it never equals the
// overlay copy's path.
function linkTarget(path: string): string {
  return lstatSync(path).isSymbolicLink() ? realpathSync(path) : `${path} is not a symlink`;
}

export default defineStep({
  description: "Reads where .agents/skills/<name> (Codex) and .claude/skills/<name> (Claude Code) resolve as symlinks, and claims each is the overlay copy.",
  pattern: "both hosts' discovery paths link to the overlay copy",
  args: z.object({ checkout: z.string(), skillsDir: z.string(), repository: z.string(), name: z.string() }),
  from: {
    checkout: [createTargetCheckout, "checkout"],
    skillsDir: [configureStow, "skillsDir"],
    repository: [createTargetCheckout, "repository"],
    name: [writeGeneratedSkill, "name"],
  },
  observe({}, { checkout, skillsDir, repository, name }) {
    return {
      overlaySkill: realpathSync(join(skillsDir, repository, name)),
      codex: linkTarget(join(checkout, HOST_PATHS.codex, name)),
      claudeCode: linkTarget(join(checkout, HOST_PATHS.claudeCode, name)),
    };
  },
  claims: [
    { actual: "codex", compare: "equal", expected: { observe: "overlaySkill" } },
    { actual: "claudeCode", compare: "equal", expected: { observe: "overlaySkill" } },
  ],
});
