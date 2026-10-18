import { defineStep, z } from "nukadoko";
import { lstatSync, readFileSync } from "node:fs";
import { join } from "node:path";
import adoptSkill from "./adopt-skill.ts";
import configureStow from "./configure-stow.ts";
import createTargetCheckout from "./create-target-checkout.ts";
import writeGeneratedSkill from "./write-generated-skill.ts";

// lstat, not stat: the overlay copy must be a real directory, or the skill
// would still live in the checkout behind a link.
export default defineStep({
  description: "Asserts adopt exited 0 and every file of the skill is a real file in <skillsDir>/<owner>/<repo>/<name> with its content.",
  pattern: "the skill's files live in the overlay for that repository",
  args: z.object({
    exitCode: z.number(),
    stderr: z.string(),
    skillsDir: z.string(),
    repository: z.string(),
    name: z.string(),
    files: z.record(z.string(), z.string()),
  }),
  returns: z.object({ overlaySkill: z.string().describe("the skill's directory in the overlay") }),
  from: {
    exitCode: [adoptSkill, "exitCode"],
    stderr: [adoptSkill, "stderr"],
    skillsDir: [configureStow, "skillsDir"],
    repository: [createTargetCheckout, "repository"],
    name: [writeGeneratedSkill, "name"],
    files: [writeGeneratedSkill, "files"],
  },
  mutates: false,
  run({}, { exitCode, stderr, skillsDir, repository, name, files }) {
    if (exitCode !== 0) throw new Error(`stow adopt exited ${exitCode}: ${stderr}`);
    const overlaySkill = join(skillsDir, repository, name);
    if (!lstatSync(overlaySkill).isDirectory()) throw new Error(`${overlaySkill} is not a directory`);
    for (const [file, content] of Object.entries(files)) {
      const actual = readFileSync(join(overlaySkill, file), "utf8");
      if (actual !== content) throw new Error(`${file} in the overlay differs from what the agent wrote`);
    }
    return { overlaySkill };
  },
});
