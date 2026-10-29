import { defineStep, z } from "nukadoko";
import { runStow } from "./stow-cli.ts";
import configureStow from "./configure-stow.ts";
import createTargetCheckout from "./create-target-checkout.ts";
import writeGeneratedSkill from "./write-generated-skill.ts";

// The path is relative to the checkout, as an agent would type it from there.
// A failed adopt fails here: no sentence of the scenario states the exit code,
// so a Then has no expected value to claim it against.
export default defineStep({
  description: "Runs `stow adopt <path>` from the checkout and fails when stow exits non-zero.",
  pattern: "the agent adopts the skill",
  args: z.object({ checkout: z.string(), home: z.string(), path: z.string() }),
  from: { checkout: [createTargetCheckout, "checkout"], home: [configureStow, "home"], path: [writeGeneratedSkill, "path"] },
  mutates: true,
  async run({}, { checkout, home, path }) {
    const { exitCode, stderr } = await runStow(["adopt", path], checkout, home);
    if (exitCode !== 0) throw new Error(`stow adopt exited ${exitCode}: ${stderr}`);
  },
});
