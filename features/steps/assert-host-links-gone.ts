import { defineStep, z } from "nukadoko";
import { existsSync, lstatSync } from "node:fs";
import { join } from "node:path";
import { HOST_PATHS } from "./assert-host-links.ts";
import createTargetCheckout from "./create-target-checkout.ts";
import removeSkill from "./remove-skill.ts";
import writeGeneratedSkill from "./write-generated-skill.ts";

function present(path: string): boolean {
  try {
    lstatSync(path);
    return true;
  } catch {
    return false;
  }
}

// existsSync follows a link, so a dangling link would read as gone; lstat sees
// the link itself.
export default defineStep({
  description: "Asserts remove exited 0 and no host path holds anything under the skill's name, not even a dangling link.",
  pattern: "neither host path links to it any more",
  args: z.object({ exitCode: z.number(), stderr: z.string(), checkout: z.string(), name: z.string() }),
  from: {
    exitCode: [removeSkill, "exitCode"],
    stderr: [removeSkill, "stderr"],
    checkout: [createTargetCheckout, "checkout"],
    name: [writeGeneratedSkill, "name"],
  },
  mutates: false,
  run({}, { exitCode, stderr, checkout, name }) {
    if (exitCode !== 0) throw new Error(`stow remove exited ${exitCode}: ${stderr}`);
    for (const hostPath of HOST_PATHS) {
      const link = join(checkout, hostPath, name);
      if (present(link)) throw new Error(`${hostPath}/${name} is still there${existsSync(link) ? "" : " as a dangling link"}`);
    }
  },
});
