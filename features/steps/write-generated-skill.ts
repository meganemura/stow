import { defineStep, z } from "nukadoko";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import createTargetCheckout from "./create-target-checkout.ts";

export default defineStep({
  description: "Writes a skill named release-notes under the checkout's .agents/skills, with a SKILL.md and a reference file.",
  pattern: "the agent wrote a skill under the target's shared skill directory",
  args: z.object({ checkout: z.string() }),
  returns: z.object({
    name: z.string().describe("the skill's name"),
    path: z.string().describe("the skill's directory, relative to the checkout"),
    files: z.record(z.string(), z.string()).describe("each file of the skill, relative to its directory, and its content"),
  }),
  from: { checkout: [createTargetCheckout, "checkout"] },
  mutates: true,
  rationale: "A reference file beside SKILL.md shows the whole directory moves, not only the one file stow validates.",
  run({}, { checkout }) {
    const name = "release-notes";
    const path = `.agents/skills/${name}`;
    const files: Record<string, string> = {
      "SKILL.md": `---\nname: ${name}\ndescription: Draft release notes from merged pull requests.\n---\n\n# ${name}\n`,
      "references/format.md": "One line per change.\n",
    };
    for (const [file, content] of Object.entries(files)) {
      mkdirSync(join(checkout, path, file, ".."), { recursive: true });
      writeFileSync(join(checkout, path, file), content);
    }
    return { name, path, files };
  },
});
