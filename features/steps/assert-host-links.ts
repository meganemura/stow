import { defineStep, z } from "nukadoko";
import { lstatSync, realpathSync } from "node:fs";
import { join } from "node:path";
import assertOverlayHoldsSkill from "./assert-overlay-holds-skill.ts";
import createTargetCheckout from "./create-target-checkout.ts";
import writeGeneratedSkill from "./write-generated-skill.ts";

export const HOST_PATHS = [".agents/skills", ".claude/skills"];

// Codex reads .agents/skills and Claude Code reads .claude/skills; realpath on
// both sides tolerates a temp directory that is itself behind a symlink, as on
// macOS.
export default defineStep({
  description: "Asserts .agents/skills/<name> (Codex) and .claude/skills/<name> (Claude Code) are symlinks that resolve to the overlay copy.",
  pattern: "both hosts' discovery paths link to the overlay copy",
  args: z.object({ checkout: z.string(), name: z.string(), overlaySkill: z.string() }),
  from: {
    checkout: [createTargetCheckout, "checkout"],
    name: [writeGeneratedSkill, "name"],
    overlaySkill: [assertOverlayHoldsSkill, "overlaySkill"],
  },
  mutates: false,
  run({}, { checkout, name, overlaySkill }) {
    for (const hostPath of HOST_PATHS) {
      const link = join(checkout, hostPath, name);
      if (!lstatSync(link).isSymbolicLink()) throw new Error(`${hostPath}/${name} is not a symlink`);
      if (realpathSync(link) !== realpathSync(overlaySkill)) throw new Error(`${hostPath}/${name} does not resolve to ${overlaySkill}`);
    }
  },
});
