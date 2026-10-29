import { defineStep, z } from "nukadoko";
import { runStow } from "./stow-cli.ts";
import configureStow from "./configure-stow.ts";
import createTargetCheckout from "./create-target-checkout.ts";
import writeGeneratedSkill from "./write-generated-skill.ts";

// remove takes the skill's name, not a path, because the skill now lives in
// the overlay. A failed remove fails here, as adopt does.
export default defineStep({
  description: "Runs `stow remove <name>` from the checkout and fails when stow exits non-zero.",
  pattern: "the agent removes the skill",
  args: z.object({ checkout: z.string(), home: z.string(), name: z.string() }),
  from: { checkout: [createTargetCheckout, "checkout"], home: [configureStow, "home"], name: [writeGeneratedSkill, "name"] },
  mutates: true,
  async run({}, { checkout, home, name }) {
    const { exitCode, stderr } = await runStow(["remove", name], checkout, home);
    if (exitCode !== 0) throw new Error(`stow remove exited ${exitCode}: ${stderr}`);
  },
});
