import { defineStep, runCommand, z } from "nukadoko";
import createTargetCheckout from "./create-target-checkout.ts";

// stow writes exact info/exclude patterns for its links; a clean status is
// what keeps a later `git add .` from committing them.
export default defineStep({
  description: "Runs `git status --porcelain` in the checkout and claims it prints nothing.",
  pattern: "git status in the target shows no new file",
  args: z.object({ checkout: z.string() }),
  from: { checkout: [createTargetCheckout, "checkout"] },
  async observe({}, { checkout }) {
    const { exitCode, stdout, stderr } = await runCommand("git", ["-C", checkout, "status", "--porcelain"]);
    if (exitCode !== 0) throw new Error(`git status exited ${exitCode}: ${stderr}`);
    return { status: stdout };
  },
  claims: [{ actual: "status", compare: "equal", expected: { literal: "" } }],
});
