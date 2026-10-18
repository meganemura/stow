import { defineStep, runCommand, z } from "nukadoko";
import createTargetCheckout from "./create-target-checkout.ts";

// stow writes exact info/exclude patterns for its links; a clean status is
// what keeps a later `git add .` from committing them.
export default defineStep({
  description: "Asserts `git status --porcelain` in the checkout prints nothing.",
  pattern: "git status in the target shows no new file",
  args: z.object({ checkout: z.string() }),
  from: { checkout: [createTargetCheckout, "checkout"] },
  mutates: false,
  async run({}, { checkout }) {
    const { exitCode, stdout: status, stderr } = await runCommand("git", ["-C", checkout, "status", "--porcelain"]);
    if (exitCode !== 0) throw new Error(`git status exited ${exitCode}: ${stderr}`);
    if (status !== "") throw new Error(`git status is not clean:\n${status}`);
  },
});
