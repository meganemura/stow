import { defineStep, z } from "nukadoko";
import { lstatSync, readdirSync, readFileSync, readlinkSync } from "node:fs";
import { join } from "node:path";
import configureStow from "./configure-stow.ts";
import createTargetCheckout from "./create-target-checkout.ts";
import writeGeneratedSkill from "./write-generated-skill.ts";

// lstat, not stat: the overlay copy must be a real directory of real files, or
// the skill would still live in the checkout behind a link. A link inside the
// overlay is read as its target, so it never equals a file's content.
function filesUnder(dir: string, prefix = ""): Record<string, string> {
  const files: Record<string, string> = {};
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    const relative = prefix + entry.name;
    if (entry.isDirectory()) Object.assign(files, filesUnder(path, `${relative}/`));
    else if (entry.isSymbolicLink()) files[relative] = `link to ${readlinkSync(path)}`;
    else files[relative] = readFileSync(path, "utf8");
  }
  return files;
}

export default defineStep({
  description: "Reads every file under <skillsDir>/<owner>/<repo>/<name> without following links, and claims they are the files the agent wrote, with their content.",
  pattern: "the skill's files live in the overlay for that repository",
  args: z.object({
    skillsDir: z.string(),
    repository: z.string(),
    name: z.string(),
    files: z.record(z.string(), z.string()),
  }),
  from: {
    skillsDir: [configureStow, "skillsDir"],
    repository: [createTargetCheckout, "repository"],
    name: [writeGeneratedSkill, "name"],
    files: [writeGeneratedSkill, "files"],
  },
  observe({}, { skillsDir, repository, name }) {
    const overlaySkill = join(skillsDir, repository, name);
    if (!lstatSync(overlaySkill).isDirectory()) throw new Error(`${overlaySkill} is not a directory`);
    return { overlayFiles: filesUnder(overlaySkill) };
  },
  claims: [{ actual: "overlayFiles", compare: "equal", expected: { from: "files" } }],
});
