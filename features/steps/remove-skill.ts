import { defineStep, z } from "nukadoko";
import { runStow } from "./stow-cli.ts";
import configureStow from "./configure-stow.ts";
import createTargetCheckout from "./create-target-checkout.ts";
import writeGeneratedSkill from "./write-generated-skill.ts";

export default defineStep({
  description: "Runs `stow remove <name>` from the checkout.",
  pattern: "the agent removes the skill",
  args: z.object({ checkout: z.string(), home: z.string(), name: z.string() }),
  returns: z.object({ exitCode: z.number().describe("stow's exit code"), stderr: z.string().describe("stow's stderr") }),
  from: { checkout: [createTargetCheckout, "checkout"], home: [configureStow, "home"], name: [writeGeneratedSkill, "name"] },
  mutates: true,
  rationale: "remove takes the skill's name, not a path, because the skill now lives in the overlay.",
  run({}, { checkout, home, name }) {
    const { exitCode, stderr } = runStow(["remove", name], checkout, home);
    return { exitCode, stderr };
  },
});
