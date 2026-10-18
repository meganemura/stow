import { defineStep, runCommand, z } from "nukadoko";

// stow picks the overlay from the origin URL, so the checkout needs a
// GitHub-style remote. Nothing is fetched from it.
export default defineStep({
  description: "Creates a scratch git checkout whose origin is git@github.com:alice/weather-app.git.",
  pattern: "a target checkout whose origin is a GitHub repository",
  args: z.object({}),
  returns: z.object({
    checkout: z.string().describe("the target checkout's root"),
    repository: z.string().describe("the owner/repo stow reads from origin"),
  }),
  mutates: true,
  async run({ scratch }) {
    const checkout = scratch.dir("stow-scenario-checkout");
    for (const args of [["init", "--quiet", checkout], ["-C", checkout, "remote", "add", "origin", "git@github.com:alice/weather-app.git"]]) {
      const { exitCode, stderr } = await runCommand("git", args);
      if (exitCode !== 0) throw new Error(`git ${args.join(" ")} exited ${exitCode}: ${stderr}`);
    }
    return { checkout, repository: "alice/weather-app" };
  },
});
