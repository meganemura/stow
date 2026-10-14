import { defineStep, z } from "nukadoko";
import { execFileSync } from "node:child_process";
import createTargetCheckout from "./create-target-checkout.ts";

export default defineStep({
  description: "Asserts `git status --porcelain` in the checkout prints nothing.",
  pattern: "git status in the target shows no new file",
  args: z.object({ checkout: z.string() }),
  returns: z.object({}),
  from: { checkout: [createTargetCheckout, "checkout"] },
  mutates: false,
  rationale: "stow writes exact info/exclude patterns for its links; a clean status is what keeps a later `git add .` from committing them.",
  run({}, { checkout }) {
    const status = execFileSync("git", ["-C", checkout, "status", "--porcelain"], { encoding: "utf8" });
    if (status !== "") throw new Error(`git status is not clean:\n${status}`);
    return {};
  },
});
