import { defineStep, z } from "nukadoko";
import { runStow } from "./stow-cli.ts";
import configureStow from "./configure-stow.ts";
import createTargetCheckout from "./create-target-checkout.ts";
import writeGeneratedSkill from "./write-generated-skill.ts";

// The path is relative to the checkout, as an agent would type it from there.
export default defineStep({
  description: "Runs `stow adopt <path>` from the checkout.",
  pattern: "the agent adopts the skill",
  args: z.object({ checkout: z.string(), home: z.string(), path: z.string() }),
  returns: z.object({ exitCode: z.number().describe("stow's exit code"), stderr: z.string().describe("stow's stderr") }),
  from: { checkout: [createTargetCheckout, "checkout"], home: [configureStow, "home"], path: [writeGeneratedSkill, "path"] },
  mutates: true,
  async run({}, { checkout, home, path }) {
    const { exitCode, stderr } = await runStow(["adopt", path], checkout, home);
    return { exitCode, stderr };
  },
});
